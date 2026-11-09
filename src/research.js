// Teaching Research Data Store and Renderer

export function createResearchStore() {
  const topicIds = new Set();
  const cache = new Map();
  const inFlight = new Map();

  async function loadIndex() {
    try {
      const res = await fetch('/data/research-index.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.topicIds)) {
        data.topicIds.forEach(id => topicIds.add(id));
      }
      return true;
    } catch (err) {
      console.warn('Could not load teaching research index:', err);
      return false;
    }
  }

  function has(topicId) {
    return topicIds.has(topicId);
  }

  async function get(topicId) {
    if (!has(topicId)) return null;
    if (cache.has(topicId)) return cache.get(topicId);
    if (inFlight.has(topicId)) return inFlight.get(topicId);

    const promise = (async () => {
      try {
        const res = await fetch(`/data/research/${topicId}.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        cache.set(topicId, data);
        return data;
      } catch (err) {
        console.error(`Failed loading research for ${topicId}:`, err);
        throw err;
      } finally {
        inFlight.delete(topicId);
      }
    })();

    inFlight.set(topicId, promise);
    return promise;
  }

  return { loadIndex, has, get, topicCount: () => topicIds.size };
}

export function renderResearchLoading(container) {
  container.innerHTML = `
    <div class="research-skeleton">
      <div class="skeleton-line title"></div>
      <div class="skeleton-line text"></div>
      <div class="skeleton-line text short"></div>
      <div class="skeleton-card"></div>
    </div>
  `;
}

export function renderResearchError(container, onRetry) {
  container.innerHTML = `
    <div class="research-error-box">
      <p class="research-error-text">Could not load teaching research for this skill.</p>
      <button type="button" class="research-retry-btn">Retry</button>
    </div>
  `;
  const btn = container.querySelector('.research-retry-btn');
  if (btn && onRetry) {
    btn.addEventListener('click', onRetry);
  }
}

export function renderResearchContent(container, record) {
  container.innerHTML = '';

  const frag = document.createDocumentFragment();

  // Header row
  const headerRow = document.createElement('div');
  headerRow.className = 'section-title-split';
  headerRow.innerHTML = `
    <h4 class="section-heading">How to teach this</h4>
    <span class="research-tag-pill">Guide available</span>
  `;
  frag.appendChild(headerRow);

  // Summary
  if (record.summary) {
    const summaryP = document.createElement('p');
    summaryP.className = 'research-summary';
    summaryP.textContent = record.summary;
    frag.appendChild(summaryP);
  }

  // Misconceptions
  if (record.misconceptions && record.misconceptions.length > 0) {
    const miscHeading = document.createElement('h5');
    miscHeading.className = 'research-subheading';
    miscHeading.textContent = 'Common misconceptions to watch for';
    frag.appendChild(miscHeading);

    const miscList = document.createElement('ul');
    miscList.className = 'research-misconceptions-list';
    record.misconceptions.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      miscList.appendChild(li);
    });
    frag.appendChild(miscList);
  }

  // Suggested Activities
  if (record.activities && record.activities.length > 0) {
    const actHeading = document.createElement('h5');
    actHeading.className = 'research-subheading';
    actHeading.textContent = 'Suggested learning activities';
    frag.appendChild(actHeading);

    const actContainer = document.createElement('div');
    actContainer.className = 'research-activities-list';

    record.activities.forEach((act, idx) => {
      const details = document.createElement('details');
      details.className = 'research-activity-card';
      if (idx === 0) details.open = true; // Open the first activity by default for immediate engagement

      const summary = document.createElement('summary');
      summary.className = 'activity-summary';
      summary.innerHTML = `
        <span class="activity-title">${escapeHtml(act.title)}</span>
        <span class="activity-toggle-icon" aria-hidden="true">▾</span>
      `;
      details.appendChild(summary);

      const body = document.createElement('div');
      body.className = 'activity-body';

      if (act.steps && act.steps.length > 0) {
        const stepsList = document.createElement('ol');
        stepsList.className = 'activity-steps';
        act.steps.forEach(step => {
          const stepLi = document.createElement('li');
          stepLi.textContent = step;
          stepsList.appendChild(stepLi);
        });
        body.appendChild(stepsList);
      }

      if (act.insight) {
        const insightBox = document.createElement('div');
        insightBox.className = 'activity-insight';
        insightBox.innerHTML = `<strong>Key takeaway:</strong> ${escapeHtml(act.insight)}`;
        body.appendChild(insightBox);
      }

      details.appendChild(body);
      actContainer.appendChild(details);
    });

    frag.appendChild(actContainer);
  }

  // Check Understanding
  if (record.checkQuestion) {
    const checkHeading = document.createElement('h5');
    checkHeading.className = 'research-subheading';
    checkHeading.textContent = 'Check understanding';
    frag.appendChild(checkHeading);

    const checkCard = document.createElement('div');
    checkCard.className = 'research-check-card';

    const questionP = document.createElement('p');
    questionP.className = 'research-check-question';
    questionP.textContent = record.checkQuestion;
    checkCard.appendChild(questionP);

    if (record.checkAnswer) {
      const answerToggle = document.createElement('details');
      answerToggle.className = 'research-answer-toggle';
      answerToggle.innerHTML = `
        <summary>Show expected answer</summary>
        <p class="research-check-answer">${escapeHtml(record.checkAnswer)}</p>
      `;
      checkCard.appendChild(answerToggle);
    }

    frag.appendChild(checkCard);
  }

  // Attribution & Notice
  const notice = document.createElement('p');
  notice.className = 'research-disclaimer';
  notice.textContent = 'AI-drafted teaching guidance from the Marble taxonomy. Research-informed, not tested in classrooms.';
  frag.appendChild(notice);

  container.appendChild(frag);
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
