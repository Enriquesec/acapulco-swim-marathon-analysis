const normalizeText = (text = '') => text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const buildSearchIndex = (...fields) => normalizeText(fields.filter(Boolean).join(' '));

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
        recordSummary
    );

    return entry;
};

let ageDistributionChart = null;
let distanceDistributionChart = null;

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

    if (!searchInput || !resultsContainer) return;

    const formatTime = (hours = '0', minutes = '0', seconds = '0') => {
        const safeHours = String(hours || '0').padStart(2, '0');
        const safeMinutes = String(minutes || '0').padStart(2, '0');
        const safeSeconds = String(seconds || '0').padStart(2, '0');
        return `${safeHours}:${safeMinutes}:${safeSeconds}`;
    };

    const extractYear = (eventString = '') => {
        const match = eventString.match(/(20\d{2})/);
        return match ? match[1] : 'Año N/D';
    };

    const normalizeResult = (result) => ({
        year: result.year || extractYear(result.evento),
        distance: result.distance || result.distancia || 'Distancia N/D',
        category: result.category || result.categoria || 'Categoría N/D',
        time: result.time || formatTime(result.time_hours, result.time_minutes, result.time_seconds),
        positionCategory: result.position_category || result['lugar_categoría'] || '—',
        positionGender: result.lugar_rama || '—',
        positionGeneral: result.position_general || result.lugar_general || '—',
        name: result.name || result.nombre_completo || 'Nombre no disponible',
        bib: result.bib || result['número_de_competidor'] || result.numero_de_competidor || 'N/D',
        team: result.equipo || 'Sin equipo',
        origin: result.procedencia || result.estado_estandarizado || 'Procedencia no registrada',
        event: result.evento || 'Evento no especificado',
        gender: result.gender || result.sexo || '—',
        ageGroup: Array.isArray(result.edad_categorias) ? result.edad_categorias.join(', ') : (result.edad || '—')
    });

    const groupResultsByCompetitor = (data) => {
        const groups = new Map();

        data.forEach((result) => {
            const key = normalizeText(result.name);
            if (!groups.has(key)) {
                groups.set(key, {
                    name: result.name,
                    origin: result.origin,
                    team: result.team,
                    bib: result.bib,
                    gender: result.gender,
                    ageGroup: result.ageGroup,
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
            competitors.map(entry => [normalizeText(entry.name), entry])
        );

        participantsCatalog.forEach(participant => {
            const participantName = participant?.nombre_completo || '';
            const key = normalizeText(participantName);
            if (!key) return;

            const participantInfo = {
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
                if (!existing.ageGroup || existing.ageGroup === '—') {
                    existing.ageGroup = participantInfo.ageGroup;
                }
                updateSearchIndex(existing);
            } else {
                competitorMap.set(key, updateSearchIndex({
                    ...participantInfo,
                    records: []
                }));
            }
        });

        return Array.from(competitorMap.values());
    };

    try {
        const [rawResults, participantsCatalog] = await Promise.all([
            fetchJson('./assets/data/results.json'),
            fetchJson('./assets/data/participants.json').catch(error => {
                console.warn('No se pudo cargar participants.json:', error);
                return [];
            })
        ]);

        const normalizedData = rawResults.map(normalizeResult);
        const aggregatedData = groupResultsByCompetitor(normalizedData);
        const combinedData = mergeParticipantsCatalog(aggregatedData, participantsCatalog);

        const renderResults = (dataToRender) => {
            if (dataToRender.length === 0) {
                resultsContainer.innerHTML = '<p class="col-span-full text-gray-400">No se encontraron resultados para tu búsqueda.</p>';
                return;
            }

            resultsContainer.innerHTML = dataToRender.map(result => `
                <div class="card text-left space-y-4">
                    <div class="space-y-1">
                        <p class="text-xs uppercase tracking-wide text-green-400">Competidor</p>
                        <h3 class="text-2xl font-bold">${result.name}</h3>
                        <p class="text-sm text-gray-300">${result.origin}</p>
                        <p class="text-sm text-gray-400">${result.team}</p>
                        <p class="text-xs text-gray-500"># Competidor: ${result.bib} · Participaciones: ${result.records.length}</p>
                        <p class="text-xs text-gray-500">Sexo: ${result.gender || 'N/D'} · Categoría: ${result.ageGroup || 'N/D'}</p>
                    </div>
                    ${result.records.length === 0 ? `
                        <div class="bg-gray-900 rounded-lg p-4 text-sm text-gray-400">
                            Aún no registramos resultados históricos para este participante.
                        </div>
                    ` : `
                        <div class="space-y-3">
                            ${result.records.map(record => `
                                <div class="bg-gray-900 rounded-lg p-3 space-y-2">
                                    <div class="flex flex-wrap justify-between items-center gap-2">
                                        <p class="text-lg font-semibold text-green-400">${record.year} · ${record.distance}</p>
                                        <span class="text-sm font-bold">${record.time}</span>
                                    </div>
                                    <p class="text-sm"><strong>Categoría:</strong> ${record.category}</p>
                                    <div class="grid grid-cols-3 gap-2 text-center text-xs">
                                        <div class="bg-gray-800 rounded-md py-2">
                                            <p class="text-gray-400">Cat.</p>
                                            <p class="text-base font-bold">${record.positionCategory}</p>
                                        </div>
                                        <div class="bg-gray-800 rounded-md py-2">
                                            <p class="text-gray-400">Rama</p>
                                            <p class="text-base font-bold">${record.positionGender}</p>
                                        </div>
                                        <div class="bg-gray-800 rounded-md py-2">
                                            <p class="text-gray-400">Gral.</p>
                                            <p class="text-base font-bold">${record.positionGeneral}</p>
                                        </div>
                                    </div>
                                    <p class="text-xs text-gray-500">${record.event}</p>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            `).join('');
        };

        const totalCompetitors = combinedData.length;
        const instructionsMessage = `<p class="col-span-full text-gray-400">Ingresa un nombre o apellido para buscar entre ${totalCompetitors.toLocaleString('es-MX')} participantes (ej. \"Lopez\").</p>`;
        resultsContainer.innerHTML = instructionsMessage;

        searchInput.addEventListener('input', (e) => {
            const normalizedTerm = normalizeText(e.target.value);

            if (!normalizedTerm) {
                resultsContainer.innerHTML = instructionsMessage;
                return;
            }

            const filteredResults = combinedData.filter(result => 
                result.searchIndex && result.searchIndex.includes(normalizedTerm)
            );

            renderResults(filteredResults);
        });
    } catch (error) {
        resultsContainer.innerHTML = '<p class="col-span-full text-red-500">Error al cargar los datos de resultados.</p>';
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

const createEmptyState = (message) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center justify-center h-48 rounded-lg bg-gray-900 text-gray-400 text-center';
    wrapper.textContent = message;
    return wrapper;
};

async function initializeChronology() {
    const dashboard = document.getElementById('chronologyDashboard');
    if (!dashboard) return;

    try {
        const [
            indexData,
            events,
            distances,
            genders,
            ageGroups,
            rawResults
        ] = await Promise.all([
            fetchJson('./assets/data/index.json'),
            fetchJson('./assets/data/events.json'),
            fetchJson('./assets/data/distances.json'),
            fetchJson('./assets/data/genders.json'),
            fetchJson('./assets/data/age_groups.json'),
            fetchJson('./assets/data/results.json')
        ]);

        populateSelect('edition', events, 'Selecciona un evento', event => event.name, event => event.name);
        populateSelect('gender', genders, 'Selecciona un sexo', gender => gender.raw, gender => gender.raw);
        populateSelect('category', distances, 'Selecciona una distancia', distance => distance.label, distance => `${distance.label} (${distance.km} km)`);

        const counts = indexData?.counts || {};
        setTextContent('chronology-events-count', counts.events || events.length);
        setTextContent('chronology-distances-count', counts.distances || distances.length);
        setTextContent('chronology-genders-count', counts.genders || genders.length);
        setTextContent('chronology-participants-count', rawResults.length || '0');

        renderAgeChart(ageGroups);
        renderDistanceChart(rawResults);
    } catch (error) {
        console.error('Error al inicializar cronología:', error);
        dashboard.insertAdjacentElement('beforebegin', createEmptyState('No se pudieron cargar los datos de cronología.'));
    }
}
