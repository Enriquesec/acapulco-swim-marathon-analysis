const normalizeText = (text = '') => text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const buildSearchIndex = (...fields) => normalizeText(fields.filter(Boolean).join(' '));

const extractYearFromEvent = (eventString = '') => {
    const match = eventString.match(/(19|20)\d{2}/);
    return match ? match[0] : 'Año N/D';
};

const parseEventInfo = (eventString = '') => {
    const eventPattern = /id=(\d+)_([\d]+)_mara[tó]n_acapulco_(\d{4})/i;
    const match = eventString.match(eventPattern);

    if (match) {
        const [, eventId, edition, year] = match;
        return {
            eventId,
            edition,
            year,
            label: `${edition} Maratón Acapulco ${year}`
        };
    }

    const sanitizedEvent = eventString
        .replace(/^id=/i, '')
        .replace(/^\d+_?/, '')
        .replace(/_/g, ' ')
        .trim();
    const year = extractYearFromEvent(eventString);
    return {
        eventId: sanitizedEvent || null,
        edition: null,
        year,
        label: sanitizedEvent || 'Evento no especificado'
    };
};

const buildEventKey = (eventInfo, fallback = '') => {
    if (eventInfo?.eventId) {
        return `${eventInfo.eventId}-${eventInfo.year || 'nd'}`;
    }

    if (eventInfo?.label) {
        return normalizeText(`${eventInfo.label}-${eventInfo.year || ''}`);
    }

    return normalizeText(fallback);
};

const buildCompetitorKey = (id, name) => {
    if (id) return normalizeText(id);
    return normalizeText(name || '');
};

const updateSearchIndex = (entry) => {
    const recordSummary = Array.isArray(entry.records)
        ? entry.records.map(record => `${record.year} ${record.distance} ${record.category} ${record.time}`).join(' ')
        : '';

    entry.searchIndex = buildSearchIndex(
        entry.name,
        entry.origin,
        entry.team,
        entry.bib,
        entry.gender,
        entry.ageGroup,
        entry.participantId,
        recordSummary
    );

    return entry;
};

let ageDistributionChart = null;
let distanceDistributionChart = null;
let distanceUniqueChart = null;
let genderSummaryChartInstance = null;
let oneKGenderChartInstance = null;
let oneKAgeChartInstance = null;
let oneKTimeChartInstance = null;
let yearTrendChartInstance = null;
let chronologyTimeChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    const links = document.querySelectorAll('nav a[data-target]'); // Selecciona todos los enlaces del nav
    const navContainer = document.getElementById('navbar-container');
    const contentDiv = document.getElementById('content'); // Contenedor donde se cargará el contenido
    
    const loadContent = async (targetFile) => {
        try {
            // Usa fetch para cargar el archivo HTML
            const response = await fetch(`./${targetFile}`);
            if (response.ok) {
                const content = await response.text(); // Convierte la respuesta a texto
                contentDiv.innerHTML = content; // Inserta el contenido en el div
                initializeCharts(); // Llama a una función para inicializar los gráficos
                initializeEventListeners(); // Llama a una función para los nuevos listeners
                initializeSwiper(); // Llama a una función para inicializar el carrusel

                // Actualizar el estado activo de los enlaces
                links.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('data-target') === targetFile) {
                        link.classList.add('active');
                    }
                });
            } else {
                contentDiv.innerHTML = `<p>Error ${response.status}: No se pudo cargar el contenido.</p>`;
            }
        } catch (error) {
            contentDiv.innerHTML = `<p>Error: ${error.message}</p>`;
        }
    };

    links.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault(); // Evita que el navegador siga el enlace
            const targetFile = link.getAttribute('data-target'); // Obtén el archivo HTML a cargar
            loadContent(targetFile);
        });
    });

    // Carga el contenido inicial
    loadContent('inicio.html');

    // Efecto de scroll en la barra de navegación
    window.addEventListener('scroll', () => {
        if (window.scrollY > 10) {
            navContainer.querySelector('.main-nav').classList.add('scrolled');
        } else {
            navContainer.querySelector('.main-nav').classList.remove('scrolled');
        }
    });

    // Delegación de eventos para botones cargados dinámicamente
    document.addEventListener('click', (event) => {
        // Comprobar si el clic fue en el botón de "Ver Convocatoria Completa"
        if (event.target.matches('a[data-target="convocatoria.html"]')) {
            event.preventDefault();
            loadContent('convocatoria.html');
        }
    });
});

async function setupResultsPage() {
    const searchInput = document.getElementById('searchInput');
    const resultsContainer = document.getElementById('resultsContainer');
    const participantDetail = document.getElementById('participantDetail');
    const detailContent = document.getElementById('detailContent');
    const detailName = document.getElementById('detailName');
    const detailMeta = document.getElementById('detailMeta');
    const detailOrigin = document.getElementById('detailOrigin');
    const detailTeam = document.getElementById('detailTeam');
    const detailCategoryFilter = document.getElementById('detailCategoryFilter');
    const detailDistanceFilter = document.getElementById('detailDistanceFilter');
    const closeDetailButton = document.getElementById('closeParticipantDetail');
    const resultsNavigation = document.getElementById('resultsNavigation');
    const prevResultsButton = document.getElementById('prevResults');
    const nextResultsButton = document.getElementById('nextResults');
    const resultsPageIndicator = document.getElementById('resultsPageIndicator');

    const RESULTS_PER_PAGE = 10;
    let currentPage = 1;
    let currentResults = [];
    let selectedParticipant = null;

    if (!searchInput || !resultsContainer) return;

    const formatTime = (hours = '0', minutes = '0', seconds = '0') => {
        const safeHours = String(hours || '0').padStart(2, '0');
        const safeMinutes = String(minutes || '0').padStart(2, '0');
        const safeSeconds = String(seconds || '0').padStart(2, '0');
        return `${safeHours}:${safeMinutes}:${safeSeconds}`;
    };

    const normalizeResult = (result) => {
        const eventInfo = parseEventInfo(result.evento || result.event);

        return {
            year: result.year || eventInfo.year,
            distance: result.distance || result.distancia || 'Distancia N/D',
            category: result.category || result.categoria || 'Categoría N/D',
            time: result.tiempo_label || result.time || formatTime(result.time_hours, result.time_minutes, result.time_seconds),
            positionCategory: result.position_category || result['lugar_categoría'] || result.lugar_categoria || '—',
            positionGender: result.lugar_rama || result.position_gender || '—',
            positionGeneral: result.position_general || result.lugar_general || '—',
            name: result.name || result.nombre_completo || 'Nombre no disponible',
            team: result.equipo || 'Sin equipo',
            origin: result.procedencia || result.estado_estandarizado || 'Procedencia no registrada',
            event: eventInfo.label,
            eventId: eventInfo.eventId,
            eventEdition: eventInfo.edition,
            gender: result.gender || result.sexo || '—',
            ageGroup: Array.isArray(result.edad_categorias) ? result.edad_categorias.join(', ') : (result.edad || '—'),
            participantId: result.participant_id || result.participantId || null
        };
    };

    const getCategoryRange = (records = []) => {
        if (!records.length) return null;

        const sortedByYear = [...records].sort((a, b) => {
            const yearA = parseInt(a.year, 10) || 0;
            const yearB = parseInt(b.year, 10) || 0;
            return yearA - yearB;
        });

        const categories = sortedByYear
            .map(record => deriveAgeGroup(record))
            .filter(age => age && age !== 'Sin registro');

        if (!categories.length) return null;

        const uniqueCategories = Array.from(new Set(categories));
        return {
            first: categories[0],
            last: categories[categories.length - 1],
            hasRange: uniqueCategories.length > 1
        };
    };

    const groupRecordsByEvent = (records = []) => {
        const eventGroups = new Map();

        records.forEach(record => {
            const key = record.eventId || record.event || record.year || record.distance;
            if (!eventGroups.has(key)) {
                eventGroups.set(key, {
                    eventId: record.eventId || key,
                    label: record.event || 'Evento no especificado',
                    year: parseInt(record.year, 10) || 0,
                    items: []
                });
            }
            eventGroups.get(key).items.push(record);
        });

        const sortByYearDesc = (a, b) => b.year - a.year;
        return Array.from(eventGroups.values()).sort(sortByYearDesc);
    };

    const groupResultsByCompetitor = (data) => {
        const groups = new Map();

        data.forEach((result) => {
            const key = buildCompetitorKey(result.participantId, result.name);
            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    name: result.name,
                    origin: result.origin,
                    team: result.team,
                    bib: result.bib,
                    gender: result.gender,
                    ageGroup: result.ageGroup,
                    participantId: result.participantId,
                    records: []
                });
            }
            groups.get(key).records.push(result);
        });

        const sortByYearDesc = (a, b) => {
            const yearA = parseInt(a.year, 10) || 0;
            const yearB = parseInt(b.year, 10) || 0;
            return yearB - yearA;
        };

        return Array.from(groups.values()).map(group => {
            const sortedRecords = group.records.sort(sortByYearDesc);
            return updateSearchIndex({
                ...group,
                records: sortedRecords
            });
        });
    };

    const mergeParticipantsCatalog = (competitors, participantsCatalog = []) => {
        const competitorMap = new Map(
            competitors.map(entry => {
                const entryKey = entry.key || buildCompetitorKey(entry.participantId, entry.name);
                return [entryKey, { ...entry, key: entryKey }];
            })
        );

        participantsCatalog.forEach(participant => {
            const participantName = participant?.nombre_completo || '';
            const key = buildCompetitorKey(participant.participant_id, participantName);
            if (!key) return;

            const participantInfo = {
                key,
                name: participantName || 'Participante no identificado',
                origin: Array.isArray(participant.procedencias) && participant.procedencias.length > 0
                    ? participant.procedencias[0]
                    : 'Procedencia no registrada',
                team: 'Participante registrado',
                bib: participant.participant_id || 'N/D',
                gender: participant.sexo || '—',
                ageGroup: Array.isArray(participant.edad_categorias) && participant.edad_categorias.length > 0
                    ? participant.edad_categorias.join(', ')
                    : '—'
            };

            if (competitorMap.has(key)) {
                const existing = competitorMap.get(key);
                if (!existing.origin || existing.origin === 'Procedencia no registrada') {
                    existing.origin = participantInfo.origin;
                }
                if (!existing.team || existing.team === 'Sin equipo') {
                    existing.team = participantInfo.team;
                }
                if (!existing.bib || existing.bib === 'N/D') {
                    existing.bib = participantInfo.bib;
                }
                if (!existing.gender || existing.gender === '—') {
                    existing.gender = participantInfo.gender;
                }
                if (participantInfo.ageGroup && participantInfo.ageGroup !== '—') {
                    existing.ageGroup = participantInfo.ageGroup;
                }
                updateSearchIndex(existing);
            } else {
                competitorMap.set(key, updateSearchIndex({
                    ...participantInfo,
                    records: [],
                    participantId: participant.participant_id || null
                }));
            }
        });

        return Array.from(competitorMap.values());
    };

    try {
        const [rawResults, participantsCatalog] = await Promise.all([
            fetchJson('./assets/data/history_results.json'),
            fetchJson('./assets/data/participants.json').catch(error => {
                console.warn('No se pudo cargar participants.json:', error);
                return [];
            })
        ]);

        const normalizedData = rawResults.map(normalizeResult);
        const aggregatedData = groupResultsByCompetitor(normalizedData);
        const combinedData = mergeParticipantsCatalog(aggregatedData, participantsCatalog);

        const hideResultsNavigation = () => {
            if (resultsNavigation) {
                resultsNavigation.classList.add('hidden');
            }
        };

        const updateNavigation = (totalItems, totalPages) => {
            if (!resultsNavigation || !resultsPageIndicator) return;

            const shouldShow = totalItems > RESULTS_PER_PAGE;
            resultsNavigation.classList.toggle('hidden', !shouldShow);

            if (shouldShow) {
                resultsPageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;
                if (prevResultsButton) {
                    prevResultsButton.disabled = currentPage === 1;
                }
                if (nextResultsButton) {
                    nextResultsButton.disabled = currentPage === totalPages;
                }
            }
        };

        const renderResultsPage = () => {
            const totalItems = currentResults.length;
            const totalPages = Math.ceil(totalItems / RESULTS_PER_PAGE) || 1;

            currentPage = Math.min(Math.max(currentPage, 1), totalPages);

            const start = (currentPage - 1) * RESULTS_PER_PAGE;
            const paginatedResults = currentResults.slice(start, start + RESULTS_PER_PAGE);

            resultsContainer.innerHTML = paginatedResults.map(result => {
                return `
                    <div class="card text-left space-y-4 cursor-pointer hover:border-green-400" data-competitor-key="${result.key}">
                        <div class="space-y-1">
                            <p class="text-xs uppercase tracking-wide text-green-400">Competidor</p>
                            <h3 class="text-2xl font-bold">${result.name}</h3>
                            <p class="text-sm text-gray-500">Sexo: ${result.gender || 'N/D'}</p>
                            <p class="text-sm text-gray-500">Participaciones: ${result.records.length}</p>
                        </div>
                        ${result.records.length === 0 ? `
                            <div class="bg-gray-900 rounded-lg p-4 text-sm text-gray-400">
                                Aún no registramos resultados históricos para este participante.
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');

            updateNavigation(totalItems, totalPages);
        };

        const renderResults = (dataToRender) => {
            currentResults = dataToRender;
            currentPage = 1;

            if (dataToRender.length === 0) {
                resultsContainer.innerHTML = '<p class="col-span-full text-gray-400">No se encontraron resultados para tu búsqueda.</p>';
                hideResultsNavigation();
                return;
            }

            renderResultsPage();
        };

        const totalCompetitors = combinedData.length;
        const minCharacters = 6;
        const instructionsMessage = `<p class="col-span-full text-gray-400">Ingresa un nombre o apellido para buscar entre ${totalCompetitors.toLocaleString('es-MX')} participantes (ej. \"Lopez\").</p>`;
        const minLengthMessage = `<p class="col-span-full text-gray-400">Escribe al menos ${minCharacters} caracteres antes de realizar la búsqueda.</p>`;
        const searchButton = document.getElementById('searchButton');
        resultsContainer.innerHTML = instructionsMessage;
        hideResultsNavigation();

        const setSearchButtonState = (term) => {
            if (!searchButton) return;
            const isDisabled = term.length < minCharacters;
            searchButton.disabled = isDisabled;
            searchButton.classList.toggle('opacity-60', isDisabled);
            searchButton.classList.toggle('cursor-not-allowed', isDisabled);
        };

        if (prevResultsButton) {
            prevResultsButton.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage -= 1;
                    renderResultsPage();
                }
            });
        }

        if (nextResultsButton) {
            nextResultsButton.addEventListener('click', () => {
                const totalPages = Math.ceil(currentResults.length / RESULTS_PER_PAGE) || 1;
                if (currentPage < totalPages) {
                    currentPage += 1;
                    renderResultsPage();
                }
            });
        }

        const handleSearch = () => {
            const normalizedTerm = normalizeText(searchInput.value);

            if (normalizedTerm.length < minCharacters) {
                resultsContainer.innerHTML = minLengthMessage;
                hideResultsNavigation();
                setSearchButtonState(normalizedTerm);
                return;
            }

            const filteredResults = combinedData.filter(result =>
                result.searchIndex && result.searchIndex.includes(normalizedTerm)
            );

            renderResults(filteredResults);
            setSearchButtonState(normalizedTerm);
        };

        searchInput.addEventListener('input', (e) => {
            const normalizedTerm = normalizeText(e.target.value);

            if (!normalizedTerm) {
                resultsContainer.innerHTML = instructionsMessage;
                hideResultsNavigation();
                setSearchButtonState(normalizedTerm);
                return;
            }

            if (normalizedTerm.length < minCharacters) {
                resultsContainer.innerHTML = minLengthMessage;
                hideResultsNavigation();
            }

            setSearchButtonState(normalizedTerm);
        });

        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });

        if (searchButton) {
            setSearchButtonState(normalizeText(searchInput.value));
            searchButton.addEventListener('click', handleSearch);
        }

        const renderParticipantDetail = (participant) => {
            if (!participantDetail || !detailContent) return;

            selectedParticipant = participant;
            participantDetail.classList.remove('hidden');
            detailName.textContent = participant.name;
            if (detailOrigin) {
                detailOrigin.textContent = participant.origin || 'N/D';
            }
            if (detailTeam) {
                detailTeam.textContent = participant.team || 'Sin equipo';
            }

            const categoryRange = getCategoryRange(participant.records);
            const catalogAge = participant.ageGroup && participant.ageGroup !== '—' ? participant.ageGroup : null;
            const categorySummary = categoryRange?.hasRange
                ? `${categoryRange.first} → ${categoryRange.last}`
                : (categoryRange?.first || 'N/D');

            detailMeta.textContent = `Participaciones: ${participant.records.length} · Procedencia: ${participant.origin || 'N/D'} · Edad: ${catalogAge || categorySummary}`;

            const availableAgeGroups = Array.from(new Set(participant.records
                .map(record => deriveAgeGroup(record))
                .filter(age => age && age !== 'Sin registro')));

            if (detailCategoryFilter) {
                detailCategoryFilter.innerHTML = '<option value="">Todas las edades</option>' +
                    availableAgeGroups.map(age => `<option value="${age}">${age}</option>`).join('');
                detailCategoryFilter.value = '';
            }
            if (detailDistanceFilter) {
                detailDistanceFilter.value = '';
            }

            const renderDetailRecords = () => {
                if (!selectedParticipant) return;
                const categoryFilter = detailCategoryFilter?.value || '';
                const distanceFilter = detailDistanceFilter?.value || '';

                const filtered = selectedParticipant.records.filter(record => {
                    const recordAge = deriveAgeGroup(record);
                    const matchesCategory = categoryFilter ? recordAge === categoryFilter : true;
                    const normalizedDistance = normalizeDistanceLabel(record.distance);
                    const matchesDistance = distanceFilter ? normalizedDistance === distanceFilter : true;
                    return matchesCategory && matchesDistance;
                });

                const sections = [
                    { label: '1K', distance: '1K' },
                    { label: '5K', distance: '5K' },
                    { label: 'Otras distancias', distance: 'OTHER' }
                ];

                const buildSection = (section) => {
                    const sectionRecords = filtered.filter(record => {
                        const normalizedDistance = normalizeDistanceLabel(record.distance);
                        if (section.distance === 'OTHER') {
                            return normalizedDistance !== '1K' && normalizedDistance !== '5K';
                        }
                        return normalizedDistance === section.distance;
                    });

                    if (!sectionRecords.length) return '';

                    return `
                        <div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
                            <div class="flex items-center justify-between mb-3">
                                <p class="text-sm uppercase tracking-wide text-green-400">${section.label}</p>
                                <p class="text-xs text-gray-400">${sectionRecords.length} participaciones</p>
                            </div>
                            <div class="space-y-3">
                                ${sectionRecords.map(record => `
                                    <div class="bg-gray-800/60 rounded-lg p-3">
                                        <div class="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <p class="text-base font-semibold">${record.year} · ${record.eventEdition ? `${record.eventEdition} Maratón Acapulco` : record.event}</p>
                                                <p class="text-xs text-gray-400">Categoría: ${record.category}</p>
                                            </div>
                                            <p class="text-lg font-bold text-green-400">${record.time}</p>
                                        </div>
                                        <div class="grid grid-cols-3 gap-2 text-center text-xs mt-2">
                                            <div class="bg-gray-900 rounded-md py-2">
                                                <p class="text-gray-400">Cat.</p>
                                                <p class="text-base font-bold">${record.positionCategory}</p>
                                            </div>
                                            <div class="bg-gray-900 rounded-md py-2">
                                                <p class="text-gray-400">Rama</p>
                                                <p class="text-base font-bold">${record.positionGender}</p>
                                            </div>
                                            <div class="bg-gray-900 rounded-md py-2">
                                                <p class="text-gray-400">Gral.</p>
                                                <p class="text-base font-bold">${record.positionGeneral}</p>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                };

                const renderedSections = sections.map(buildSection).filter(Boolean).join('');
                detailContent.innerHTML = renderedSections || '<p class="text-gray-400">No hay participaciones que coincidan con los filtros seleccionados.</p>';
            };

            if (detailCategoryFilter) {
                detailCategoryFilter.onchange = renderDetailRecords;
            }
            if (detailDistanceFilter) {
                detailDistanceFilter.onchange = renderDetailRecords;
            }
            if (closeDetailButton) {
                closeDetailButton.onclick = () => {
                    participantDetail.classList.add('hidden');
                    selectedParticipant = null;
                };
            }

            renderDetailRecords();
        };

        resultsContainer.addEventListener('click', (event) => {
            const card = event.target.closest('[data-competitor-key]');
            if (!card) return;

            const key = card.getAttribute('data-competitor-key');
            const participant = combinedData.find(item => item.key === key);
            if (participant) {
                renderParticipantDetail(participant);
            }
        });
    } catch (error) {
        resultsContainer.innerHTML = '<p class="col-span-full text-red-500">Error al cargar los datos de resultados.</p>';
        hideResultsNavigation();
        console.error('Error fetching results data:', error);
    }
}

function initializeEventListeners() {
    const applyFiltersButton = document.getElementById('applyFilters');
    if (applyFiltersButton) {
        applyFiltersButton.addEventListener('click', () => {
            const edition = document.getElementById('edition').value;
            const gender = document.getElementById('gender').value;
            const category = document.getElementById('category').value;
        
            console.log('Edición seleccionada:', edition);
            console.log('Sexo seleccionado:', gender);
            console.log('Categoría seleccionada:', category);
        
            // Aquí puedes filtrar los datos según los valores seleccionados
        });
    }

    // Configurar la página de resultados si los elementos existen
    setupResultsPage();
    initializeChronology();
}

function initializeCharts() {
    // El código para inicializar Chart.js que tenías antes va aquí.
    // Esto asegura que los gráficos se creen cada vez que se carga nuevo contenido.
}

function initializeSwiper() {
    const swiperContainer = document.querySelector('.swiper');

    // Si la librería Swiper no se ha cargado todavía, espera un poco y vuelve a intentarlo.
    if (typeof Swiper === 'undefined') {
        setTimeout(initializeSwiper, 100); // Reintentar después de 100ms
        return;
    }

    if (swiperContainer) {
        new Swiper(swiperContainer, {
            // Opciones de Swiper
            loop: true, // Para que el carrusel sea infinito
            slidesPerView: 1, // Muestra 1 slide a la vez en móvil
            spaceBetween: 30, // Espacio entre slides
            autoplay: { // Configuración de autoplay
                delay: 3000, // 3 segundos entre cada slide
                disableOnInteraction: false, // No se detiene si el usuario interactúa
            },
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
            breakpoints: {
                // Cuando el ancho de la ventana es >= 768px
                768: {
                    slidesPerView: 3, // Muestra 3 slides
                }
            }
        });
    }
}

const fetchJson = async (path) => {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`No se pudo cargar ${path} (${response.status})`);
    }
    return response.json();
};

const normalizeDistanceLabel = (value = '') => {
    const cleaned = value.toString().trim().toUpperCase();
    if (!cleaned) return '';
    if (cleaned.includes('1')) return '1K';
    if (cleaned.includes('5')) return '5K';
    return cleaned;
};

const deriveAgeGroup = (record) => {
    if (record.edad) return record.edad;
    if (record.edad_categorias && Array.isArray(record.edad_categorias) && record.edad_categorias.length > 0) {
        return record.edad_categorias.join(', ');
    }
    if (record.categoria) {
        const match = record.categoria.match(/(\d+\s*-\s*\d+)/);
        if (match) return match[1];
    }
    return record.ageGroup || 'Sin registro';
};

const buildParticipantKey = (recordOrId, fallbackName = '') => {
    if (!recordOrId) {
        return normalizeText(fallbackName);
    }

    if (typeof recordOrId === 'string' || typeof recordOrId === 'number') {
        return normalizeText(recordOrId);
    }

    const record = recordOrId;

    return (
        record.participant_id ||
        record.participantId ||
        record['número_de_competidor'] ||
        record.numero_de_competidor ||
        record.bib ||
        normalizeText(record.nombre_completo || record.name || fallbackName)
    );
};

const parseResultTimeInMinutes = (record) => {
    if (record.time && typeof record.time === 'string') {
        const parts = record.time.split(':').map(part => parseInt(part, 10));
        if (parts.length === 3 && parts.every(num => !Number.isNaN(num))) {
            return parts[0] * 60 + parts[1] + parts[2] / 60;
        }
        if (parts.length === 2 && parts.every(num => !Number.isNaN(num))) {
            return parts[0] * 60 + parts[1];
        }
    }

    const hours = parseFloat(record.time_hours ?? record.hours ?? record.horas);
    const minutes = parseFloat(record.time_minutes ?? record.minutes ?? record.minutos);
    const seconds = parseFloat(record.time_seconds ?? record.seconds ?? record.segundos);

    if (!Number.isNaN(hours) || !Number.isNaN(minutes) || !Number.isNaN(seconds)) {
        return (Number.isNaN(hours) ? 0 : hours) * 60 +
            (Number.isNaN(minutes) ? 0 : minutes) +
            (Number.isNaN(seconds) ? 0 : seconds) / 60;
    }

    return null;
};

const normalizeRecordForStats = (record) => {
    const distanceLabel = normalizeDistanceLabel(record.distance || record.distancia || record['distancia (km)']);
    if (!distanceLabel) return null;

    const genderRaw = record.sexo || record.gender || 'No especificado';
    const gender = genderRaw.toString().trim().toUpperCase();

    const eventName = record.evento || record.event || 'Evento no especificado';
    const eventInfo = parseEventInfo(eventName);
    const category = record.categoria || record.category || 'Categoría N/D';

    return {
        participantKey: buildParticipantKey(record, record.nombre_completo || record.name),
        name: record.nombre_completo || record.name || 'Sin nombre',
        gender,
        ageGroup: deriveAgeGroup(record),
        distance: distanceLabel,
        category,
        event: eventInfo.label,
        eventKey: buildEventKey(eventInfo, eventName),
        timeMinutes: parseResultTimeInMinutes(record),
        year: eventInfo.year
    };
};

const aggregateUniqueParticipantsByDistance = (records) => {
    const distanceMap = new Map();

    records.forEach(record => {
        if (!record) return;
        const key = record.distance;
        if (!distanceMap.has(key)) {
            distanceMap.set(key, new Set());
        }
        distanceMap.get(key).add(record.participantKey);
    });

    return Array.from(distanceMap.entries()).map(([distance, participants]) => ({
        label: distance,
        count: participants.size
    })).sort((a, b) => a.label.localeCompare(b.label));
};

const aggregateParticipantsByYear = (records) => {
    const yearMap = new Map();

    records.forEach(record => {
        if (!record) return;
        const year = record.year || 'Año N/D';
        if (!yearMap.has(year)) {
            yearMap.set(year, new Set());
        }
        yearMap.get(year).add(record.participantKey);
    });

    return Array.from(yearMap.entries())
        .map(([year, participants]) => ({
            year,
            count: participants.size
        }))
        .sort((a, b) => {
            const aNum = parseInt(a.year, 10);
            const bNum = parseInt(b.year, 10);
            if (Number.isNaN(aNum) && Number.isNaN(bNum)) return a.year.localeCompare(b.year);
            if (Number.isNaN(aNum)) return 1;
            if (Number.isNaN(bNum)) return -1;
            return aNum - bNum;
        });
};

const aggregateParticipantsByEvent = (records) => {
    const eventMap = new Map();

    records.forEach(record => {
        if (!record) return;
        const key = record.eventKey || record.event || record.year || 'Evento N/D';

        if (!eventMap.has(key)) {
            eventMap.set(key, {
                key,
                label: record.event || 'Evento no especificado',
                year: record.year ? parseInt(record.year, 10) || 0 : 0,
                participants: new Set()
            });
        }

        eventMap.get(key).participants.add(record.participantKey);
    });

    return Array.from(eventMap.values())
        .map(event => ({
            label: event.label,
            year: event.year,
            count: event.participants.size
        }))
        .sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.label.localeCompare(b.label);
        });
};

const aggregateGenderDistribution = (records) => {
    return records.reduce((acc, record) => {
        if (!record) return acc;
        const key = record.gender || 'No especificado';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
};

const summarizeGenderCounts = (records) => {
    const distribution = aggregateGenderDistribution(records);
    const femaleCount = Object.entries(distribution)
        .filter(([gender]) => normalizeText(gender).startsWith('fe'))
        .reduce((sum, [, count]) => sum + count, 0);

    const maleCount = Object.entries(distribution)
        .filter(([gender]) => normalizeText(gender).includes('var') || normalizeText(gender).startsWith('ma'))
        .reduce((sum, [, count]) => sum + count, 0);

    const total = Object.values(distribution).reduce((sum, value) => sum + value, 0);

    return { femaleCount, maleCount, total };
};

const aggregateAgeDistribution = (records) => {
    return records.reduce((acc, record) => {
        if (!record) return acc;
        const key = record.ageGroup || 'Sin registro';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
};

const getTimeLimitForRecord = (record) => {
    const distance = (record?.distance || '').toUpperCase();

    if (distance === '1K') return 60;
    if (distance === '5K') return 240;

    return null;
};

const buildTimeHistogram = (values, binSize = 5, customRange = null) => {
    if (!values.length) {
        return { labels: [], counts: [], range: null };
    }

    const minValue = customRange && typeof customRange.min === 'number'
        ? customRange.min
        : Math.max(0, Math.floor(Math.min(...values) / binSize) * binSize);

    const maxValue = customRange && typeof customRange.max === 'number'
        ? customRange.max
        : Math.ceil(Math.max(...values) / binSize) * binSize;

    if (maxValue <= minValue) {
        return { labels: [], counts: [], range: null };
    }

    const labels = [];
    const counts = [];

    for (let start = minValue; start < maxValue; start += binSize) {
        const end = start + binSize;
        labels.push(`${start}-${end} min`);
        const count = values.filter(value => value >= start && (value < end || (end === maxValue && value <= end))).length;
        counts.push(count);
    }

    return { labels, counts, range: { min: minValue, max: maxValue } };
};

const getTimesByGenderWithinLimits = (records) => {
    const grouped = { overall: [], male: [], female: [] };

    records.forEach(record => {
        const time = record?.timeMinutes;
        const limit = getTimeLimitForRecord(record);

        if (typeof time !== 'number' || Number.isNaN(time)) return;
        if (limit && time > limit) return;

        grouped.overall.push(time);

        const normalizedGender = normalizeText(record.gender);
        if (normalizedGender.startsWith('fe')) {
            grouped.female.push(time);
        } else if (normalizedGender.includes('var') || normalizedGender.startsWith('ma')) {
            grouped.male.push(time);
        }
    });

    return grouped;
};

const populateSelect = (id, data, placeholder, getValue, getLabel) => {
    const select = document.getElementById(id);
    if (!select) return;

    select.innerHTML = `<option value="">${placeholder}</option>`;
    data.forEach(item => {
        const option = document.createElement('option');
        option.value = getValue(item);
        option.textContent = getLabel(item);
        select.appendChild(option);
    });
};

const setTextContent = (id, value) => {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
};

const aggregateDistanceCounts = (results) => {
    return results.reduce((acc, item) => {
        const key = item.distance || item.distancia || 'Sin dato';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
};

const renderAgeChart = (ageGroups) => {
    const canvas = document.getElementById('activityChart');
    if (!canvas) return;

    const validGroups = ageGroups.filter(group => group.count && group.count > 0);
    if (validGroups.length === 0) {
        canvas.replaceWith(createEmptyState('Sin datos de grupos de edad disponibles.'));
        return;
    }

    const labels = validGroups.map(group => group.label);
    const counts = validGroups.map(group => group.count);

    if (ageDistributionChart) {
        ageDistributionChart.destroy();
    }

    ageDistributionChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Participantes',
                data: counts,
                backgroundColor: '#48bb78'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#e2e8f0'
                    }
                },
                x: {
                    ticks: {
                        color: '#e2e8f0'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#e2e8f0'
                    }
                }
            }
        }
    });
};

const renderChronologyAgeChart = (records) => {
    const canvas = document.getElementById('chronologyAgeChart');
    if (!canvas) return;

    const distribution = aggregateAgeDistribution(records);
    const labels = Object.keys(distribution);
    if (!labels.length) {
        canvas.replaceWith(createEmptyState('Sin datos de edad disponibles.'));
        return;
    }

    const sortedLabels = labels.sort((a, b) => {
        const aNum = parseInt(a, 10);
        const bNum = parseInt(b, 10);
        if (Number.isNaN(aNum) && Number.isNaN(bNum)) return a.localeCompare(b);
        if (Number.isNaN(aNum)) return 1;
        if (Number.isNaN(bNum)) return -1;
        return aNum - bNum;
    });

    const counts = sortedLabels.map(label => distribution[label]);

    if (ageDistributionChart) {
        ageDistributionChart.destroy();
    }

    ageDistributionChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: sortedLabels,
            datasets: [{
                label: 'Participantes',
                data: counts,
                backgroundColor: '#48bb78'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#e2e8f0' }
                },
                x: {
                    ticks: { color: '#e2e8f0' }
                }
            }
        }
    });
};

const renderDistanceChart = (results) => {
    const canvas = document.getElementById('distanceChart');
    if (!canvas) return;

    const distanceCounts = aggregateDistanceCounts(results);
    const labels = Object.keys(distanceCounts);
    if (labels.length === 0) {
        canvas.replaceWith(createEmptyState('Sin datos de distancias disponibles.'));
        return;
    }
    const counts = Object.values(distanceCounts);
    const palette = ['#48bb78', '#63b3ed', '#ed8936', '#9f7aea', '#f6ad55', '#4fd1c5'];

    if (distanceDistributionChart) {
        distanceDistributionChart.destroy();
    }

    distanceDistributionChart = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: counts,
                backgroundColor: labels.map((_, index) => palette[index % palette.length])
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#e2e8f0'
                    }
                }
            }
        }
    });
};

const renderDistanceParticipantsChart = (data) => {
    const canvas = document.getElementById('distanceParticipantsChart');
    if (distanceUniqueChart) {
        distanceUniqueChart.destroy();
        distanceUniqueChart = null;
    }
    if (!canvas || data.length === 0) {
        return;
    }

    distanceUniqueChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: data.map(item => item.label),
            datasets: [{
                label: 'Participantes únicos',
                data: data.map(item => item.count),
                backgroundColor: '#48bb78'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#e2e8f0' }
                },
                x: {
                    ticks: { color: '#e2e8f0' }
                }
            }
        }
    });
};

const renderGenderSummaryChart = (distribution, canvasId, chartInstanceRef) => {
    const canvas = document.getElementById(canvasId);
    if (chartInstanceRef) {
        chartInstanceRef.destroy();
        chartInstanceRef = null;
    }
    if (!canvas) return null;

    const labels = Object.keys(distribution);
    const counts = Object.values(distribution);
    if (!labels.length) return null;

    const palette = ['#63b3ed', '#ed64a6', '#f6ad55', '#b794f4'];

    return new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: counts,
                backgroundColor: labels.map((_, index) => palette[index % palette.length])
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#e2e8f0'
                    }
                }
            }
        }
    });
};

const renderOneKAgeChart = (distribution) => {
    const canvas = document.getElementById('oneKAgeChart');
    if (oneKAgeChartInstance) {
        oneKAgeChartInstance.destroy();
        oneKAgeChartInstance = null;
    }
    if (!canvas) return;

    const labels = Object.keys(distribution);
    if (!labels.length) return;

    const sortedLabels = labels.sort((a, b) => {
        const aNum = parseInt(a, 10);
        const bNum = parseInt(b, 10);
        if (Number.isNaN(aNum) && Number.isNaN(bNum)) {
            return a.localeCompare(b);
        }
        if (Number.isNaN(aNum)) return 1;
        if (Number.isNaN(bNum)) return -1;
        return aNum - bNum;
    });
    const counts = sortedLabels.map(label => distribution[label]);

    oneKAgeChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: sortedLabels,
            datasets: [{
                label: 'Participantes',
                data: counts,
                backgroundColor: '#ed8936'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#e2e8f0' }
                },
                x: {
                    ticks: { color: '#e2e8f0' }
                }
            }
        }
    });
};

const renderOneKTimeChart = (records, statusElement) => {
    const canvas = document.getElementById('oneKTimeChart');
    if (!canvas) return;

    const validTimes = records
        .map(record => ({ time: record.timeMinutes, limit: getTimeLimitForRecord(record) }))
        .filter(({ time, limit }) => typeof time === 'number' && !Number.isNaN(time) && (!limit || time <= limit))
        .map(item => item.time);

    if (oneKTimeChartInstance) {
        oneKTimeChartInstance.destroy();
    }

    if (!validTimes.length) {
        if (statusElement) {
            statusElement.textContent = 'Sin tiempos registrados para los filtros seleccionados.';
            statusElement.classList.remove('hidden');
        }
        return;
    }

    if (statusElement) {
        statusElement.textContent = '';
        statusElement.classList.add('hidden');
    }

    const histogram = buildTimeHistogram(validTimes, 5);

    oneKTimeChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: histogram.labels,
            datasets: [{
                label: 'Participantes',
                data: histogram.counts,
                backgroundColor: '#9f7aea'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#e2e8f0' }
                },
                x: {
                    ticks: { color: '#e2e8f0', maxRotation: 45, minRotation: 45 }
                }
            }
        }
    });
};

const renderChronologyTimeChart = (records, statusElement) => {
    const canvas = document.getElementById('chronologyTimeChart');
    if (!canvas) return;

    const timesByGender = getTimesByGenderWithinLimits(records);
    const validTimes = timesByGender.overall;

    if (chronologyTimeChartInstance) {
        chronologyTimeChartInstance.destroy();
        chronologyTimeChartInstance = null;
    }

    if (!validTimes.length) {
        if (statusElement) {
            statusElement.textContent = 'Sin tiempos registrados para los filtros seleccionados.';
            statusElement.classList.remove('hidden');
        }
        return;
    }

    if (statusElement) {
        statusElement.textContent = '';
        statusElement.classList.add('hidden');
    }

    const histogram = buildTimeHistogram(validTimes, 5);
    const femaleHistogram = buildTimeHistogram(timesByGender.female, 5, histogram.range);
    const maleHistogram = buildTimeHistogram(timesByGender.male, 5, histogram.range);

    chronologyTimeChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: histogram.labels,
            datasets: [
                {
                    label: 'Total',
                    data: histogram.counts,
                    backgroundColor: 'rgba(159, 122, 234, 0.6)'
                },
                {
                    label: 'Mujeres',
                    data: femaleHistogram.labels.length ? femaleHistogram.counts : new Array(histogram.labels.length).fill(0),
                    backgroundColor: 'rgba(72, 187, 120, 0.7)'
                },
                {
                    label: 'Hombres',
                    data: maleHistogram.labels.length ? maleHistogram.counts : new Array(histogram.labels.length).fill(0),
                    backgroundColor: 'rgba(248, 180, 0, 0.7)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#e2e8f0' } } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#e2e8f0' }
                },
                x: {
                    ticks: { color: '#e2e8f0', maxRotation: 45, minRotation: 45 }
                }
            }
        }
    });
};

const renderEventTrendChart = (data) => {
    const canvas = document.getElementById('chronologyTrendChart');
    if (!canvas) return;

    if (yearTrendChartInstance) {
        yearTrendChartInstance.destroy();
        yearTrendChartInstance = null;
    }

    if (!data.length) return;

    yearTrendChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: data.map(item => item.label),
            datasets: [{
                label: 'Participantes únicos por evento',
                data: data.map(item => item.count),
                borderColor: '#48bb78',
                backgroundColor: 'rgba(72, 187, 120, 0.2)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#e2e8f0' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#e2e8f0' }
                },
                x: {
                    ticks: { color: '#e2e8f0' }
                }
            }
        }
    });
};

const createEmptyState = (message) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center justify-center h-48 rounded-lg bg-gray-900 text-gray-400 text-center';
    wrapper.textContent = message;
    return wrapper;
};

async function initializeChronology() {
    const summaryElement = document.getElementById('summary-events');
    if (!summaryElement) return;

    try {
        const [events, distances, genders, rawResults] = await Promise.all([
            fetchJson('./assets/data/events.json'),
            fetchJson('./assets/data/distances.json'),
            fetchJson('./assets/data/genders.json'),
            fetchJson('./assets/data/history_results.json')
        ]);

        const normalizedRecords = rawResults
            .map(normalizeRecordForStats)
            .filter(Boolean);

        const { femaleCount, maleCount, total } = summarizeGenderCounts(normalizedRecords);
        const totalUniqueParticipants = new Set(normalizedRecords.map(record => record.participantKey)).size;

        setTextContent('summary-events', events.length || '0');
        setTextContent('summary-participants', totalUniqueParticipants || '0');
        setTextContent('summary-female', femaleCount || '0');
        setTextContent('summary-male', maleCount || '0');

        const oneKParticipants = new Set(normalizedRecords.filter(record => record.distance === '1K').map(record => record.participantKey)).size;
        const fiveKParticipants = new Set(normalizedRecords.filter(record => record.distance === '5K').map(record => record.participantKey)).size;
        setTextContent('summary-1k', oneKParticipants || '0');
        setTextContent('summary-5k', fiveKParticipants || '0');

        renderChronologyAgeChart(normalizedRecords);
        renderEventTrendChart(aggregateParticipantsByEvent(normalizedRecords));

        const uniqueCategories = Array.from(new Set(normalizedRecords.map(record => record.category))).filter(Boolean).sort();
        const eventOptions = events.map(event => {
            const info = parseEventInfo(event.name);
            return { value: buildEventKey(info, event.name), label: info.label };
        });

        populateSelect('chronologyEventFilter', eventOptions, 'Todos', option => option.value, option => option.label);
        populateSelect('chronologyGenderFilter', genders, 'Todos', gender => gender.raw, gender => gender.raw);
        populateSelect('chronologyCategoryFilter', uniqueCategories, 'Todos', value => value, value => value);
        populateSelect('chronologyDistanceFilter', distances, 'Todos', distance => distance.label, distance => `${distance.label} (${distance.km} km)`);

        const eventSelect = document.getElementById('chronologyEventFilter');
        const genderSelect = document.getElementById('chronologyGenderFilter');
        const categorySelect = document.getElementById('chronologyCategoryFilter');
        const distanceSelect = document.getElementById('chronologyDistanceFilter');
        const applyButton = document.getElementById('applyChronologyFilters');
        const timeStatus = document.getElementById('chronologyTimeStatus');

        const applyFilters = () => {
            const eventValue = eventSelect ? eventSelect.value : '';
            const genderValue = genderSelect ? normalizeText(genderSelect.value) : '';
            const categoryValue = categorySelect ? categorySelect.value : '';
            const distanceValue = distanceSelect ? distanceSelect.value : '';

            const filtered = normalizedRecords.filter(record => {
                const matchesEvent = !eventValue || record.eventKey === eventValue;
                const matchesGender = !genderValue || normalizeText(record.gender) === genderValue;
                const matchesCategory = !categoryValue || record.category === categoryValue;
                const matchesDistance = !distanceValue || record.distance === distanceValue;
                return matchesEvent && matchesGender && matchesCategory && matchesDistance;
            });

            const genderCounts = summarizeGenderCounts(filtered);
            const uniqueParticipants = new Set(filtered.map(record => record.participantKey)).size;

            setTextContent('filtered-participants', uniqueParticipants || '0');
            setTextContent('filtered-female', genderCounts.femaleCount || '0');
            setTextContent('filtered-male', genderCounts.maleCount || '0');

            renderChronologyTimeChart(filtered, timeStatus);
        };

        [eventSelect, genderSelect, categorySelect, distanceSelect].forEach(select => {
            if (select) {
                select.addEventListener('change', applyFilters);
            }
        });

        if (applyButton) {
            applyButton.addEventListener('click', applyFilters);
        }

        applyFilters();
    } catch (error) {
        console.error('Error al inicializar cronología:', error);
        summaryElement.insertAdjacentElement('beforebegin', createEmptyState('No se pudieron cargar los datos de cronología.'));
    }
}
