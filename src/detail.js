// Detail Drawer Module

export function createDetailController({ onSelectTopic, onClose, getTopicById, getDependenciesForTopic, clusters, getSubjectColor }) {
  const drawer = document.getElementById('detail-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  const closeBtn = document.getElementById('drawer-btn-close');
  const backBtn = document.getElementById('drawer-btn-back');

  const topicIdEl = document.getElementById('drawer-topic-id');
  const subjectEl = document.getElementById('drawer-subject');
  const domainEl = document.getElementById('drawer-domain');
  const ageEl = document.getElementById('drawer-age');
  const typeEl = document.getElementById('drawer-type');
  const titleEl = document.getElementById('drawer-title');
  const descEl = document.getElementById('drawer-desc');

  const clusterBox = document.getElementById('drawer-cluster-box');
  const clusterText = document.getElementById('drawer-cluster-text');

  const prereqsCountEl = document.getElementById('drawer-prereqs-count');
  const prereqsListEl = document.getElementById('drawer-prereqs-list');
  const unlocksCountEl = document.getElementById('drawer-unlocks-count');
  const unlocksListEl = document.getElementById('drawer-unlocks-list');

  const evidenceListEl = document.getElementById('drawer-evidence-list');
  const promptBox = document.getElementById('drawer-prompt-box');
  const promptTextEl = document.getElementById('drawer-prompt-text');
  const childNameInput = document.getElementById('child-name-input');
  const standardsListEl = document.getElementById('drawer-standards-list');

  let currentTopic = null;
  const history = [];

  // Event Listeners
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);

  backBtn.addEventListener('click', () => {
    if (history.length > 0) {
      const prevId = history.pop();
      const prevTopic = getTopicById(prevId);
      if (prevTopic) {
        renderTopic(prevTopic, false);
      }
    }
  });

  childNameInput.addEventListener('input', () => {
    updateAssessmentPrompt();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) {
      close();
    }
  });

  function open(topic, addToHistory = true) {
    if (currentTopic && addToHistory && currentTopic.id !== topic.id) {
      history.push(currentTopic.id);
    }
    renderTopic(topic, addToHistory);
    drawer.classList.add('open');
    backdrop.classList.add('open');
  }

  function close() {
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    if (onClose) onClose();
  }

  function renderTopic(topic, updateHistoryState) {
    currentTopic = topic;
    backBtn.disabled = history.length === 0;

    topicIdEl.textContent = topic.id;
    titleEl.textContent = topic.name;
    descEl.textContent = topic.description || 'No description available.';

    const subjColor = getSubjectColor(topic.subject);
    subjectEl.textContent = topic.subject;
    subjectEl.style.backgroundColor = `${subjColor}22`;
    subjectEl.style.color = subjColor;
    subjectEl.style.border = `1px solid ${subjColor}55`;

    domainEl.textContent = topic.domain;
    ageEl.textContent = `Ages ${topic.ageRangeStart}–${topic.ageRangeEnd}`;
    typeEl.textContent = topic.type;

    // Cluster summary (parent-friendly context)
    const matchedCluster = clusters.find(
      c => c.subject === topic.subject &&
           c.domain === topic.domain &&
           c.ageRangeStart === topic.ageRangeStart
    );

    if (matchedCluster && matchedCluster.summary) {
      clusterText.textContent = matchedCluster.summary;
      clusterBox.style.display = 'block';
    } else {
      clusterBox.style.display = 'none';
    }

    // Dependencies
    const { prereqs, unlocks } = getDependenciesForTopic(topic.id);
    prereqsCountEl.textContent = prereqs.length;
    unlocksCountEl.textContent = unlocks.length;

    renderPrereqList(prereqsListEl, prereqs, 'prereq');
    renderPrereqList(unlocksListEl, unlocks, 'unlock');

    // Evidence
    evidenceListEl.innerHTML = '';
    if (topic.evidence && topic.evidence.length > 0) {
      topic.evidence.forEach(ev => {
        const li = document.createElement('li');
        li.className = 'evidence-item';
        li.textContent = ev;
        evidenceListEl.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.className = 'evidence-item';
      li.textContent = 'Evidence criteria pending specification.';
      evidenceListEl.appendChild(li);
    }

    // Assessment Prompt
    updateAssessmentPrompt();

    // Standards
    standardsListEl.innerHTML = '';
    if (topic.standards && topic.standards.length > 0) {
      topic.standards.forEach(std => {
        const span = document.createElement('span');
        span.className = 'standard-tag';
        span.textContent = std;
        standardsListEl.appendChild(span);
      });
    } else {
      const span = document.createElement('span');
      span.className = 'standard-tag';
      span.textContent = 'No direct curriculum codes mapped';
      standardsListEl.appendChild(span);
    }

    drawer.querySelector('.drawer-content').scrollTop = 0;
  }

  function updateAssessmentPrompt() {
    if (!currentTopic || !currentTopic.assessmentPrompt) {
      promptTextEl.textContent = 'No assessment prompt formulated.';
      return;
    }
    const name = childNameInput.value.trim() || 'the learner';
    const text = currentTopic.assessmentPrompt.replace(/\{\{name\}\}/g, name);
    promptTextEl.textContent = `"${text}"`;
  }

  function renderPrereqList(container, items, type) {
    container.innerHTML = '';
    if (items.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.style.fontSize = '0.75rem';
      emptyDiv.style.color = 'var(--text-dim)';
      emptyDiv.style.fontStyle = 'italic';
      emptyDiv.textContent = type === 'prereq' ? 'No prerequisites (Foundational concept)' : 'No known onward dependencies';
      container.appendChild(emptyDiv);
      return;
    }

    items.forEach(dep => {
      const targetId = type === 'prereq' ? dep.prerequisiteId : dep.topicId;
      const targetTopic = getTopicById(targetId);
      const div = document.createElement('div');
      div.className = 'dep-item';

      const isHard = dep.strength === 'hard';
      const strengthBadge = `<span class="${isHard ? 'dep-badge-hard' : 'dep-badge-soft'}">${dep.strength.toUpperCase()}</span>`;
      const topicName = targetTopic ? targetTopic.name : targetId;
      const ageText = targetTopic ? ` (Ages ${targetTopic.ageRangeStart}–${targetTopic.ageRangeEnd})` : '';

      div.innerHTML = `
        <div class="dep-item-top">
          <span class="dep-item-name">${escapeHtml(topicName)}${ageText}</span>
          ${strengthBadge}
        </div>
        ${dep.reason ? `<div class="dep-item-reason">${escapeHtml(dep.reason)}</div>` : ''}
      `;

      div.addEventListener('click', () => {
        if (targetTopic) {
          open(targetTopic, true);
          if (onSelectTopic) onSelectTopic(targetTopic);
        }
      });

      container.appendChild(div);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m]));
  }

  return { open, close, getCurrentTopic: () => currentTopic };
}
