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

const TYPE_LABELS = {
  CONCEPTUAL: 'Understanding',
  PROCEDURAL: 'Step-by-step',
  REPRESENTATIONAL: 'Visual',
  LANGUAGE: 'Language',
  META: 'Learning habits'
};
const typeLabel = t => TYPE_LABELS[t] || t;

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
let currentView = 'graph';
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
    document.getElementById('graph-status-title').textContent = 'Loading skills...';
    document.getElementById('graph-status-subtitle').textContent = '';

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
    renderMobileLegend();
    const graphEmpty = document.getElementById('graph-empty');
    if (graphEmpty) {
      graphEmpty.addEventListener('pointerdown', e => e.stopPropagation());
    }
    const btnGraphEmptyReset = document.getElementById('btn-graph-empty-reset');
    if (btnGraphEmptyReset) {
      btnGraphEmptyReset.addEventListener('click', () => filterController.resetAll());
    }
    setView('graph');
    applyFilters();
  } catch (err) {
    console.error('Initialization error:', err);
    filteredCountBadge.textContent = 'Error loading dataset';
    document.getElementById('graph-status-title').textContent = 'Could not load the skills';
    document.getElementById('graph-status-subtitle').textContent = 'Check your connection and refresh the page.';
  }
}

function renderMobileLegend() {
  const legendWrap = document.getElementById('legend-scroll-wrap');
  if (!legendWrap) return;
  legendWrap.innerHTML = '';
  Object.keys(SUBJECT_COLORS).forEach(subj => {
    const color = SUBJECT_COLORS[subj];
    const chip = document.createElement('button');
    chip.className = 'legend-chip';
    chip.setAttribute('type', 'button');
    chip.innerHTML = `<span class="legend-dot" style="background-color: ${color}"></span><span>${subj}</span>`;
    chip.addEventListener('click', () => {
      const state = filterController.getState();
      if (state.selectedSubjects.has(subj) && state.selectedSubjects.size === 1) {
        state.selectedSubjects = new Set(Object.keys(SUBJECT_COLORS));
      } else {
        state.selectedSubjects = new Set([subj]);
      }
      applyFilters();
    });
    legendWrap.appendChild(chip);
  });
}

function handleSelectTopic(topic) {
  currentFocusTopic = topic;
  detailController.open(topic, true);

  const guideBanner = document.getElementById('graph-guide-banner');
  if (guideBanner) guideBanner.classList.add('is-hidden');

  // Sync selected card state in cards view
  document.querySelectorAll('.topic-card').forEach(c => {
    const isTarget = c.dataset.id === topic.id;
    c.classList.toggle('selected', isTarget);
    c.setAttribute('aria-pressed', isTarget ? 'true' : 'false');
  });

  if (currentView === 'graph') {
    if (graphVisualizer.setFocusTopic) {
      graphVisualizer.setFocusTopic(topic);
    } else {
      graphVisualizer.setGraphData({
        filteredTopics,
        dependencies: allDependencies,
        topicMap,
        focusTopic: topic
      });
    }
  }
}

function handleResetFocus() {
  currentFocusTopic = null;
  document.querySelectorAll('.topic-card.selected').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-pressed', 'false');
  });

  if (currentView === 'graph') {
    if (graphVisualizer.setFocusTopic) {
      graphVisualizer.setFocusTopic(null);
    } else {
      graphVisualizer.setGraphData({
        filteredTopics,
        dependencies: allDependencies,
        topicMap,
        focusTopic: null
      });
    }
  }
}

function setupViewEvents() {
  btnViewCards.addEventListener('click', () => setView('cards'));
  btnViewGraph.addEventListener('click', () => setView('graph'));

  const btnDismissGuide = document.getElementById('btn-dismiss-guide');
  const guideBanner = document.getElementById('graph-guide-banner');
  if (btnDismissGuide && guideBanner) {
    try { if (localStorage.getItem('strata.guideDismissed') === '1') guideBanner.classList.add('is-hidden'); } catch (e) {}
    btnDismissGuide.addEventListener('click', () => {
      guideBanner.classList.add('is-hidden');
      try { localStorage.setItem('strata.guideDismissed', '1'); } catch (e) {}
    });
  }

  btnLoadMore.addEventListener('click', () => {
    displayedCount += PAGE_SIZE;
    renderCards(false);
  });
}

function setView(view) {
  currentView = view;
  document.body.dataset.view = view;
  btnViewCards.classList.toggle('active', view === 'cards');
  btnViewGraph.classList.toggle('active', view === 'graph');

  // Close inspector drawer on view switch so open drawer never leaks into the other view
  if (detailController) {
    detailController.close();
  }

  const appLayout = document.querySelector('.app-layout');
  if (appLayout) appLayout.classList.toggle('graph-active', view === 'graph');

  const resultsBar = document.getElementById('results-bar');

  if (view === 'cards') {
    cardsWrapper.style.display = 'block';
    graphWrapper.style.display = 'none';
    if (resultsBar) resultsBar.style.display = 'flex';
  } else {
    cardsWrapper.style.display = 'none';
    graphWrapper.style.display = 'flex';
    if (resultsBar) resultsBar.style.display = 'none';
    if (filteredTopics && filteredTopics.length > 0) {
      graphVisualizer.setGraphData({
        filteredTopics,
        dependencies: allDependencies,
        topicMap,
        focusTopic: currentFocusTopic
      });
    }
    graphVisualizer.resize();
  }
}

function applyFilters() {
  const { query, minAge, maxAge, selectedSubjects, selectedDomain, sortBy } = filterController.getState();

  filteredTopics = allTopics.filter(t => {
    if (query && !t._searchTokens.includes(query)) return false;
    if (t.ageRangeEnd < minAge || t.ageRangeStart > maxAge) return false;
    if (!selectedSubjects.has(t.subject)) return false;
    if (selectedDomain && t.domain !== selectedDomain) return false;
    return true;
  });

  sortTopics(filteredTopics, sortBy);

  filteredCountBadge.textContent = `${filteredTopics.length.toLocaleString()} skill${filteredTopics.length === 1 ? '' : 's'} found`;
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

  const srStatus = document.getElementById('sr-status');
  if (srStatus) {
    srStatus.textContent = `${filteredTopics.length.toLocaleString()} skill${filteredTopics.length === 1 ? '' : 's'} found`;
  }

  const graphEmpty = document.getElementById('graph-empty');
  if (graphEmpty) {
    graphEmpty.hidden = filteredTopics.length > 0;
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
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    const isSelected = Boolean(currentFocusTopic && currentFocusTopic.id === topic.id);
    if (isSelected) {
      card.classList.add('selected');
    }
    card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');

    const color = getSubjectColor(topic.subject);
    const prereqCount = prereqsMap.get(topic.id)?.length || 0;
    const unlockCount = unlocksMap.get(topic.id)?.length || 0;
    const isFoundation = (topic.centrality || 0) >= 0.16;

    card.setAttribute(
      'aria-label',
      `${topic.name}. ${topic.subject}, Ages ${topic.ageRangeStart} to ${topic.ageRangeEnd}. ${typeLabel(topic.type)}. Learn first: ${prereqCount}, Leads to: ${unlockCount}.`
    );

    card.innerHTML = `
      <div class="card-top">
        <div class="card-pills">
          <span class="pill-subject" style="background-color: ${color}22; color: ${color}; border: 1px solid ${color}55;">${escapeHtml(topic.subject)}</span>
          <span class="pill-age">Age ${topic.ageRangeStart}–${topic.ageRangeEnd}</span>
        </div>
        <span class="card-type-tag">${typeLabel(topic.type)}</span>
      </div>
      <h3 class="card-title">${escapeHtml(topic.name)}</h3>
      <p class="card-desc">${escapeHtml(topic.description || '')}</p>
      <div class="card-footer">
        <span class="card-stat-pill" title="Required skills to learn first">
          Learn first: <strong>${prereqCount}</strong>
        </span>
        <span class="card-stat-pill" title="Skills this leads to">
          Leads to: <strong>${unlockCount}</strong>
        </span>
        ${isFoundation ? '<span class="card-stat-pill" title="Many later skills build on this one.">Foundation skill</span>' : ''}
      </div>
    `;

    const selectCard = () => {
      document.querySelectorAll('.topic-card.selected').forEach(c => {
        c.classList.remove('selected');
        c.setAttribute('aria-pressed', 'false');
      });
      card.classList.add('selected');
      card.setAttribute('aria-pressed', 'true');
      handleSelectTopic(topic);
    };

    card.addEventListener('click', selectCard);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectCard();
      }
    });

    frag.appendChild(card);
  });

  topicsGrid.appendChild(frag);

  if (displayedCount < filteredTopics.length) {
    btnLoadMore.style.display = 'inline-block';
    paginationInfo.textContent = `Showing 1–${slice.length} of ${filteredTopics.length.toLocaleString()}`;
  } else {
    btnLoadMore.style.display = 'none';
    paginationInfo.textContent = `Showing all ${filteredTopics.length.toLocaleString()} skills`;
  }
}


function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}

window.addEventListener('DOMContentLoaded', init);
