// Main Application Coordinator & View Engine
import { createDetailController } from './detail.js';
import { createGraphVisualizer } from './graph.js';
import { createFilterController } from './filters.js';

const SUBJECT_COLORS = {
  'Science': '#10b981',
  'Mathematics': '#3b82f6',
  'English': '#f59e0b',
  'History': '#f43f5e',
  'Personal & Social Development': '#a855f7',
  'Life Skills': '#06b6d4',
  'Computing': '#6366f1',
  'Learning to Learn': '#14b8a6'
};

function getSubjectColor(subject) {
  return SUBJECT_COLORS[subject] || '#818cf8';
}

// Global State
let allTopics = [];
let allDependencies = [];
let allClusters = [];
const topicMap = new Map();
const prereqsMap = new Map();
const unlocksMap = new Map();

let filteredTopics = [];
let displayedCount = 48;
const PAGE_SIZE = 48;
let currentView = 'cards';
let currentFocusTopic = null;

let filterController = null;
let detailController = null;
let graphVisualizer = null;

// DOM Elements
const btnViewCards = document.getElementById('btn-view-cards');
const btnViewGraph = document.getElementById('btn-view-graph');
const cardsWrapper = document.getElementById('cards-view-wrapper');
const graphWrapper = document.getElementById('graph-view-wrapper');
const topicsGrid = document.getElementById('topics-grid');
const emptyState = document.getElementById('empty-state');
const filteredCountBadge = document.getElementById('filtered-count');
const btnLoadMore = document.getElementById('btn-load-more');
const paginationInfo = document.getElementById('pagination-info');

async function init() {
  try {
    filteredCountBadge.textContent = 'Loading dataset...';

    const [topicsRes, depsRes, clustersRes] = await Promise.all([
      fetch('/data/topics.json').then(r => r.json()),
      fetch('/data/dependencies.json').then(r => r.json()),
      fetch('/data/clusters.json').then(r => r.json())
    ]);

    allTopics = topicsRes.topics;
    allDependencies = depsRes.dependencies;
    allClusters = clustersRes.clusters;

    allTopics.forEach(t => {
      topicMap.set(t.id, t);
      t._searchTokens = `${t.name} ${t.description || ''} ${t.id} ${t.domain} ${(t.standards || []).join(' ')}`.toLowerCase();
    });

    allDependencies.forEach(dep => {
      if (!prereqsMap.has(dep.topicId)) prereqsMap.set(dep.topicId, []);
      prereqsMap.get(dep.topicId).push(dep);

      if (!unlocksMap.has(dep.prerequisiteId)) unlocksMap.set(dep.prerequisiteId, []);
      unlocksMap.get(dep.prerequisiteId).push(dep);
    });

    // Controllers
    detailController = createDetailController({
      onSelectTopic: handleSelectTopic,
      onClose: handleResetFocus,
      getTopicById: id => topicMap.get(id),
      getDependenciesForTopic: id => ({
        prereqs: prereqsMap.get(id) || [],
        unlocks: unlocksMap.get(id) || []
      }),
      clusters: allClusters,
      getSubjectColor
    });

    graphVisualizer = createGraphVisualizer({
      onSelectTopic: handleSelectTopic,
      onResetFocus: handleResetFocus,
      getSubjectColor
    });

    filterController = createFilterController({
      allTopics,
      subjectColors: SUBJECT_COLORS,
      onFilterChange: applyFilters
    });

    filterController.init();
    setupViewEvents();
    renderGraphLegend();
    applyFilters();
  } catch (err) {
    console.error('Initialization error:', err);
    filteredCountBadge.textContent = 'Error loading dataset';
  }
}

function handleSelectTopic(topic) {
  currentFocusTopic = topic;
  detailController.open(topic, true);

  if (currentView === 'graph') {
    graphVisualizer.setGraphData({
      filteredTopics,
      dependencies: allDependencies,
      topicMap,
      focusTopic: topic
    });
  }
}

function handleResetFocus() {
  currentFocusTopic = null;
  document.querySelectorAll('.topic-card.selected').forEach(c => c.classList.remove('selected'));

  graphVisualizer.setGraphData({
    filteredTopics,
    dependencies: allDependencies,
    topicMap,
    focusTopic: null
  });
}

function setupViewEvents() {
  btnViewCards.addEventListener('click', () => setView('cards'));
  btnViewGraph.addEventListener('click', () => setView('graph'));

  btnLoadMore.addEventListener('click', () => {
    displayedCount += PAGE_SIZE;
    renderCards(false);
  });
}

function setView(view) {
  currentView = view;
  btnViewCards.classList.toggle('active', view === 'cards');
  btnViewGraph.classList.toggle('active', view === 'graph');

  if (view === 'cards') {
    cardsWrapper.style.display = 'block';
    graphWrapper.style.display = 'none';
  } else {
    cardsWrapper.style.display = 'none';
    graphWrapper.style.display = 'flex';
    graphVisualizer.setGraphData({
      filteredTopics,
      dependencies: allDependencies,
      topicMap,
      focusTopic: currentFocusTopic
    });
  }
}

function applyFilters() {
  const { query, minAge, maxAge, selectedSubjects, selectedDomain, selectedType, sortBy } = filterController.getState();

  filteredTopics = allTopics.filter(t => {
    if (query && !t._searchTokens.includes(query)) return false;
    if (t.ageRangeEnd < minAge || t.ageRangeStart > maxAge) return false;
    if (!selectedSubjects.has(t.subject)) return false;
    if (selectedDomain && t.domain !== selectedDomain) return false;
    if (selectedType !== 'ALL' && t.type !== selectedType) return false;
    return true;
  });

  sortTopics(filteredTopics, sortBy);

  filteredCountBadge.textContent = `${filteredTopics.length.toLocaleString()} topic${filteredTopics.length === 1 ? '' : 's'} found`;
  filterController.updateActiveFilterTags();

  displayedCount = PAGE_SIZE;
  renderCards(true);

  if (currentView === 'graph') {
    graphVisualizer.setGraphData({
      filteredTopics,
      dependencies: allDependencies,
      topicMap,
      focusTopic: currentFocusTopic
    });
  }
}

function sortTopics(list, sortBy) {
  switch (sortBy) {
    case 'age-asc':
      list.sort((a, b) => a.ageRangeStart - b.ageRangeStart || a.ageRangeEnd - b.ageRangeEnd);
      break;
    case 'age-desc':
      list.sort((a, b) => b.ageRangeStart - a.ageRangeStart || b.ageRangeEnd - a.ageRangeEnd);
      break;
    case 'centrality-desc':
      list.sort((a, b) => (b.centrality || 0) - (a.centrality || 0));
      break;
    case 'name-asc':
      list.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'prereqs-desc':
      list.sort((a, b) => (prereqsMap.get(b.id)?.length || 0) - (prereqsMap.get(a.id)?.length || 0));
      break;
    case 'unlocks-desc':
      list.sort((a, b) => (unlocksMap.get(b.id)?.length || 0) - (unlocksMap.get(a.id)?.length || 0));
      break;
  }
}

function renderCards(resetScroll = false) {
  if (resetScroll) {
    cardsWrapper.scrollTop = 0;
    topicsGrid.innerHTML = '';
  }

  if (filteredTopics.length === 0) {
    topicsGrid.innerHTML = '';
    emptyState.style.display = 'block';
    btnLoadMore.style.display = 'none';
    paginationInfo.textContent = '';
    return;
  }

  emptyState.style.display = 'none';
  const slice = filteredTopics.slice(0, displayedCount);
  topicsGrid.innerHTML = '';

  const frag = document.createDocumentFragment();
  slice.forEach(topic => {
    const card = document.createElement('article');
    card.className = 'topic-card';
    card.dataset.id = topic.id;
    if (currentFocusTopic && currentFocusTopic.id === topic.id) {
      card.classList.add('selected');
    }

    const color = getSubjectColor(topic.subject);
    const prereqCount = prereqsMap.get(topic.id)?.length || 0;
    const unlockCount = unlocksMap.get(topic.id)?.length || 0;

    card.innerHTML = `
      <div class="card-top">
        <div class="card-pills">
          <span class="pill-subject" style="background-color: ${color}22; color: ${color}; border: 1px solid ${color}55;">${escapeHtml(topic.subject)}</span>
          <span class="pill-age">Age ${topic.ageRangeStart}–${topic.ageRangeEnd}</span>
        </div>
        <span class="card-type-tag">${topic.type}</span>
      </div>
      <h3 class="card-title">${escapeHtml(topic.name)}</h3>
      <p class="card-desc">${escapeHtml(topic.description || '')}</p>
      <div class="card-footer">
        <span class="card-stat-pill" title="Required prerequisites">
          <strong>${prereqCount}</strong> prereq${prereqCount === 1 ? '' : 's'}
        </span>
        <span class="card-stat-pill" title="Topics unlocked">
          <strong>${unlockCount}</strong> unlocks
        </span>
        <span class="card-stat-pill" title="Graph centrality score">
          Key: <strong>${Math.round((topic.centrality || 0) * 100)}%</strong>
        </span>
      </div>
    `;

    card.addEventListener('click', () => {
      document.querySelectorAll('.topic-card.selected').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      handleSelectTopic(topic);
    });

    frag.appendChild(card);
  });

  topicsGrid.appendChild(frag);

  if (displayedCount < filteredTopics.length) {
    btnLoadMore.style.display = 'inline-block';
    paginationInfo.textContent = `Showing 1–${slice.length} of ${filteredTopics.length.toLocaleString()}`;
  } else {
    btnLoadMore.style.display = 'none';
    paginationInfo.textContent = `Showing all ${filteredTopics.length.toLocaleString()} topics`;
  }
}

function renderGraphLegend() {
  const legend = document.getElementById('graph-legend');
  legend.innerHTML = '';
  Object.entries(SUBJECT_COLORS).forEach(([subj, col]) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<span style="width: 8px; height: 8px; border-radius: 50%; background: ${col}; display: inline-block;"></span><span>${subj}</span>`;
    legend.appendChild(item);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}

window.addEventListener('DOMContentLoaded', init);
