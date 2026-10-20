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
  const sortSelect = document.getElementById('sort-select');
  const btnResetFilters = document.getElementById('btn-reset-filters');
  const btnEmptyReset = document.getElementById('btn-empty-reset');
  const activeFilterTags = document.getElementById('active-filter-tags');
  const sidebarFilters = document.getElementById('sidebar-filters');
  const sidebarHeader = document.getElementById('sidebar-header');
  const btnToggleFiltersMobile = document.getElementById('btn-toggle-filters-mobile');
  const filtersMobileSummary = document.getElementById('filters-mobile-summary');

  function init() {
    setupEvents();
    renderSubjectChips();
    updateSearchPlaceholder();
    updateMobileFilterSummary();
    window.addEventListener('resize', updateSearchPlaceholder);
  }

  function updateSearchPlaceholder() {
    if (!searchInput) return;
    if (window.innerWidth <= 600) {
      searchInput.placeholder = 'Search 1,591 skills...';
    } else {
      searchInput.placeholder = 'Search skills, for example fractions or phonics (Press / to focus)';
    }
  }

  function updateMobileFilterSummary() {
    if (!filtersMobileSummary) return;
    const isAllSubjects = filterState.selectedSubjects.size === Object.keys(subjectColors).length;
    const subjText = isAllSubjects ? 'All Subjects' : `${filterState.selectedSubjects.size} Subject${filterState.selectedSubjects.size === 1 ? '' : 's'}`;
    filtersMobileSummary.textContent = `Ages ${filterState.minAge}–${filterState.maxAge} · ${subjText}`;
  }

  function setupEvents() {
    if (btnToggleFiltersMobile && sidebarFilters) {
      const toggleMobileFilters = (e) => {
        if (e.target.closest('#btn-reset-filters')) return;
        if (window.innerWidth <= 900) {
          const isExp = sidebarFilters.classList.toggle('is-expanded');
          btnToggleFiltersMobile.setAttribute('aria-expanded', isExp ? 'true' : 'false');
          const txtEl = btnToggleFiltersMobile.querySelector('.toggle-text');
          if (txtEl) txtEl.textContent = isExp ? 'Done' : 'Filters';
        }
      };
      btnToggleFiltersMobile.addEventListener('click', toggleMobileFilters);
      if (sidebarHeader) {
        sidebarHeader.addEventListener('click', (e) => {
          if (e.target === sidebarHeader || e.target.closest('.sidebar-header-title-wrap')) {
            toggleMobileFilters(e);
          }
        });
      }
    }

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
      onFilterChange();
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

    updateMobileFilterSummary();
    onFilterChange();
  }

  function renderSubjectChips() {
    subjectChipsContainer.innerHTML = '';
    const counts = {};
    allTopics.forEach(t => {
      counts[t.subject] = (counts[t.subject] || 0) + 1;
    });

    Object.keys(subjectColors).forEach(subject => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.setAttribute('aria-pressed', 'true');
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
        updateMobileFilterSummary();
        onFilterChange();
      });

      subjectChipsContainer.appendChild(chip);
    });
  }

  function updateSubjectChipsActiveState() {
    subjectChipsContainer.querySelectorAll('.subject-chip').forEach(chip => {
      chip.classList.toggle('active', filterState.selectedSubjects.has(chip.dataset.subject));
      chip.setAttribute('aria-pressed', filterState.selectedSubjects.has(chip.dataset.subject) ? 'true' : 'false');
    });
    updateMobileFilterSummary();
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

    filterState.sortBy = 'age-asc';
    sortSelect.value = 'age-asc';

    updateMobileFilterSummary();
    onFilterChange();
  }

  return {
    init,
    getState: () => filterState,
    updateActiveFilterTags,
    resetAll
  };
}
