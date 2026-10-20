// Filter Controls Module
export function createFilterController({
  allTopics,
  subjectColors,
  onFilterChange
}) {
  const filterState = {
    query: '',
    minAge: 4,
    maxAge: 15,
    selectedSubjects: new Set(Object.keys(subjectColors)),
    selectedDomain: '',
    selectedType: 'ALL',
    sortBy: 'age-asc'
  };

  const searchInput = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  const ageDisplay = document.getElementById('age-display');
  const ageMinInput = document.getElementById('age-min-input');
  const ageMaxInput = document.getElementById('age-max-input');
  const ageMinVal = document.getElementById('age-min-val');
  const ageMaxVal = document.getElementById('age-max-val');
  const agePresets = document.getElementById('age-presets');
  const subjectChipsContainer = document.getElementById('subject-chips');
  const btnSelectAllSubjects = document.getElementById('btn-select-all-subjects');
  const domainSelect = document.getElementById('domain-select');
  const typeChipsContainer = document.getElementById('type-chips');
  const sortSelect = document.getElementById('sort-select');
  const btnResetFilters = document.getElementById('btn-reset-filters');
  const btnEmptyReset = document.getElementById('btn-empty-reset');
  const activeFilterTags = document.getElementById('active-filter-tags');

  function init() {
    setupEvents();
    renderSubjectChips();
    updateDomainOptions();
  }

  function setupEvents() {
    searchInput.addEventListener('input', () => {
      filterState.query = searchInput.value.trim().toLowerCase();
      searchClearBtn.style.display = filterState.query ? 'block' : 'none';
      onFilterChange();
    });

    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      filterState.query = '';
      searchClearBtn.style.display = 'none';
      searchInput.focus();
      onFilterChange();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchInput && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });

    ageMinInput.addEventListener('input', () => {
      const minVal = parseInt(ageMinInput.value, 10);
      const maxVal = parseInt(ageMaxInput.value, 10);
      if (minVal > maxVal) ageMaxInput.value = minVal;
      syncAgeFilters();
    });

    ageMaxInput.addEventListener('input', () => {
      const minVal = parseInt(ageMinInput.value, 10);
      const maxVal = parseInt(ageMaxInput.value, 10);
      if (maxVal < minVal) ageMinInput.value = maxVal;
      syncAgeFilters();
    });

    agePresets.querySelectorAll('.preset-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        agePresets.querySelectorAll('.preset-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        ageMinInput.value = parseInt(btn.dataset.min, 10);
        ageMaxInput.value = parseInt(btn.dataset.max, 10);
        syncAgeFilters();
      });
    });

    btnSelectAllSubjects.addEventListener('click', () => {
      filterState.selectedSubjects = new Set(Object.keys(subjectColors));
      updateSubjectChipsActiveState();
      updateDomainOptions();
      onFilterChange();
    });

    domainSelect.addEventListener('change', () => {
      filterState.selectedDomain = domainSelect.value;
      onFilterChange();
    });

    typeChipsContainer.querySelectorAll('.type-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        typeChipsContainer.querySelectorAll('.type-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterState.selectedType = btn.dataset.type;
        onFilterChange();
      });
    });

    sortSelect.addEventListener('change', () => {
      filterState.sortBy = sortSelect.value;
      onFilterChange();
    });

    btnResetFilters.addEventListener('click', resetAll);
    btnEmptyReset.addEventListener('click', resetAll);
  }

  function syncAgeFilters() {
    const min = parseInt(ageMinInput.value, 10);
    const max = parseInt(ageMaxInput.value, 10);
    filterState.minAge = min;
    filterState.maxAge = max;
    ageMinVal.textContent = min;
    ageMaxVal.textContent = max;
    ageDisplay.textContent = `Ages ${min} – ${max}`;

    agePresets.querySelectorAll('.preset-chip').forEach(btn => {
      const bMin = parseInt(btn.dataset.min, 10);
      const bMax = parseInt(btn.dataset.max, 10);
      btn.classList.toggle('active', bMin === min && bMax === max);
    });

    onFilterChange();
  }

  function renderSubjectChips() {
    subjectChipsContainer.innerHTML = '';
    const counts = {};
    allTopics.forEach(t => {
      counts[t.subject] = (counts[t.subject] || 0) + 1;
    });

    Object.keys(subjectColors).forEach(subject => {
      const chip = document.createElement('div');
      chip.className = 'subject-chip active';
      chip.dataset.subject = subject;
      const color = subjectColors[subject];
      chip.style.setProperty('--chip-color', color);

      chip.innerHTML = `
        <div class="subject-chip-left">
          <span class="chip-dot" style="background-color: ${color}"></span>
          <span>${subject}</span>
        </div>
        <span class="chip-count">${counts[subject] || 0}</span>
      `;

      chip.addEventListener('click', () => {
        if (filterState.selectedSubjects.has(subject)) {
          if (filterState.selectedSubjects.size > 1) {
            filterState.selectedSubjects.delete(subject);
          } else {
            filterState.selectedSubjects = new Set(Object.keys(subjectColors));
          }
        } else {
          filterState.selectedSubjects.add(subject);
        }
        updateSubjectChipsActiveState();
        updateDomainOptions();
        onFilterChange();
      });

      subjectChipsContainer.appendChild(chip);
    });
  }

  function updateSubjectChipsActiveState() {
    subjectChipsContainer.querySelectorAll('.subject-chip').forEach(chip => {
      chip.classList.toggle('active', filterState.selectedSubjects.has(chip.dataset.subject));
    });
  }

  function updateDomainOptions() {
    const domains = new Set();
    allTopics.forEach(t => {
      if (filterState.selectedSubjects.has(t.subject)) {
        domains.add(t.domain);
      }
    });

    const sortedDomains = Array.from(domains).sort();
    const currentDomain = filterState.selectedDomain;

    domainSelect.innerHTML = '<option value="">All Domains</option>';
    sortedDomains.forEach(dom => {
      const opt = document.createElement('option');
      opt.value = dom;
      opt.textContent = dom;
      if (dom === currentDomain) opt.selected = true;
      domainSelect.appendChild(opt);
    });

    if (!domains.has(currentDomain)) {
      filterState.selectedDomain = '';
    }
  }

  function updateActiveFilterTags() {
    activeFilterTags.innerHTML = '';
    if (filterState.query) {
      addTag(`Query: "${filterState.query}"`, () => {
        searchInput.value = '';
        filterState.query = '';
        searchClearBtn.style.display = 'none';
        onFilterChange();
      });
    }
    if (filterState.minAge > 4 || filterState.maxAge < 15) {
      addTag(`Ages ${filterState.minAge}–${filterState.maxAge}`, () => {
        ageMinInput.value = 4;
        ageMaxInput.value = 15;
        syncAgeFilters();
      });
    }
    if (filterState.selectedDomain) {
      addTag(`Domain: ${filterState.selectedDomain}`, () => {
        filterState.selectedDomain = '';
        domainSelect.value = '';
        onFilterChange();
      });
    }
    if (filterState.selectedType !== 'ALL') {
      addTag(`Type: ${filterState.selectedType}`, () => {
        filterState.selectedType = 'ALL';
        typeChipsContainer.querySelectorAll('.type-chip').forEach(b => {
          b.classList.toggle('active', b.dataset.type === 'ALL');
        });
        onFilterChange();
      });
    }
  }

  function addTag(label, onRemove) {
    const tag = document.createElement('div');
    tag.className = 'filter-tag';
    tag.innerHTML = `<span>${label}</span><span class="filter-tag-del">×</span>`;
    tag.querySelector('.filter-tag-del').addEventListener('click', onRemove);
    activeFilterTags.appendChild(tag);
  }

  function resetAll() {
    searchInput.value = '';
    filterState.query = '';
    searchClearBtn.style.display = 'none';

    ageMinInput.value = 4;
    ageMaxInput.value = 15;
    filterState.minAge = 4;
    filterState.maxAge = 15;
    ageMinVal.textContent = 4;
    ageMaxVal.textContent = 15;
    ageDisplay.textContent = 'Ages 4 – 15';
    agePresets.querySelectorAll('.preset-chip').forEach(b => {
      b.classList.toggle('active', b.dataset.min === '4' && b.dataset.max === '15');
    });

    filterState.selectedSubjects = new Set(Object.keys(subjectColors));
    updateSubjectChipsActiveState();

    filterState.selectedDomain = '';
    domainSelect.value = '';
    updateDomainOptions();

    filterState.selectedType = 'ALL';
    typeChipsContainer.querySelectorAll('.type-chip').forEach(b => {
      b.classList.toggle('active', b.dataset.type === 'ALL');
    });

    filterState.sortBy = 'age-asc';
    sortSelect.value = 'age-asc';

    onFilterChange();
  }

  return {
    init,
    getState: () => filterState,
    updateActiveFilterTags,
    resetAll
  };
}
