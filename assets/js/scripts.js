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

    const normalizeResult = (result) => ({
        year: result.year || extractYearFromEvent(result.evento || result.event),
        distance: result.distance || result.distancia || 'Distancia N/D',
        category: result.category || result.categoria || 'Categoría N/D',
        time: result.tiempo_label || result.time || formatTime(result.time_hours, result.time_minutes, result.time_seconds),
        positionCategory: result.position_category || result['lugar_categoría'] || result.lugar_categoria || '—',
        positionGender: result.lugar_rama || result.position_gender || '—',
        positionGeneral: result.position_general || result.lugar_general || '—',
        name: result.name || result.nombre_completo || 'Nombre no disponible',
        bib: result.bib || result['número_de_competidor'] || result.numero_de_competidor || result.participant_id || 'N/D',
        team: result.equipo || 'Sin equipo',
        origin: result.procedencia || result.estado_estandarizado || 'Procedencia no registrada',
        event: result.evento || 'Evento no especificado',
        gender: result.gender || result.sexo || '—',
        ageGroup: Array.isArray(result.edad_categorias) ? result.edad_categorias.join(', ') : (result.edad || '—'),
        participantId: result.participant_id || result.participantId || null
    });

    const groupResultsByCompetitor = (data) => {
        const groups = new Map();

        data.forEach((result) => {
            const key = buildCompetitorKey(result.participantId, result.name);
            if (!groups.has(key)) {
                groups.set(key, {
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
            competitors.map(entry => [buildCompetitorKey(entry.participantId, entry.name), entry])
        );

        participantsCatalog.forEach(participant => {
            const participantName = participant?.nombre_completo || '';
            const key = buildCompetitorKey(participant.participant_id, participantName);
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

const buildParticipantKey = (participantId, fallbackName = '', fallbackBib = '') => {
    const normalizedId = participantId?.toString().trim();
    if (normalizedId) return normalizedId;

    const normalizedBib = fallbackBib?.toString().trim();
    if (normalizedBib) return normalizedBib;

    return normalizeText(fallbackName || '');
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

const formatMinutesToLabel = (minutes = 0) => {
    const totalSeconds = Math.round(minutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return [hours, mins, secs].map(value => String(value).padStart(2, '0')).join(':');
};

const normalizeRecordForStats = (record) => {
    const distanceLabel = normalizeDistanceLabel(record.distance || record.distancia || record['distancia (km)']);
    if (!distanceLabel) return null;

    const genderRaw = record.sexo || record.gender || 'No especificado';
    const gender = genderRaw.toString().trim().toUpperCase();
    const timeMinutes = parseResultTimeInMinutes(record);

    const participantId = record.participant_id ||
        record.participantId ||
        record['número_de_competidor'] ||
        record.numero_de_competidor ||
        record.bib;

    return {
        participantKey: buildParticipantKey(participantId, record.nombre_completo || record.name, record.bib),
        name: record.nombre_completo || record.name || 'Sin nombre',
        gender,
        ageGroup: deriveAgeGroup(record),
        distance: distanceLabel,
        timeMinutes,
        timeLabel: record.tiempo_label || record.time || (Number.isFinite(timeMinutes) ? formatMinutesToLabel(timeMinutes) : '—'),
        category: record.categoria || record.category || 'Categoría N/D',
        event: record.evento || record.event || 'Evento N/D',
        year: extractYearFromEvent(record.evento || record.event || '')
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

const aggregateGenderDistribution = (records) => {
    return records.reduce((acc, record) => {
        if (!record) return acc;
        const key = record.gender || 'No especificado';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
};

const aggregateAgeDistribution = (records) => {
    return records.reduce((acc, record) => {
        if (!record) return acc;
        const key = record.ageGroup || 'Sin registro';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
};

const aggregateTopEventsByParticipants = (records, limit = 3) => {
    const eventMap = new Map();

    records.forEach(record => {
        if (!record) return;
        const eventKey = record.event || 'Evento N/D';
        if (!eventMap.has(eventKey)) {
            eventMap.set(eventKey, new Set());
        }
        eventMap.get(eventKey).add(record.participantKey);
    });

    return Array.from(eventMap.entries())
        .map(([event, participants]) => ({
            event,
            year: extractYearFromEvent(event),
            count: participants.size
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
};

const aggregateTopCategories = (records, limit = 3) => {
    const categoryMap = new Map();

    records.forEach(record => {
        if (!record) return;
        const category = record.category || 'Categoría N/D';
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });

    return Array.from(categoryMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
};

const findFastestPerformances = (records, limit = 3) => {
    return records
        .filter(record => record && Number.isFinite(record.timeMinutes))
        .sort((a, b) => a.timeMinutes - b.timeMinutes)
        .slice(0, limit)
        .map(item => ({
            name: item.name,
            distance: item.distance,
            timeLabel: item.timeLabel,
            gender: item.gender
        }));
};

const buildTimeHistogram = (values, binSize = 5) => {
    if (!values.length) {
        return { labels: [], counts: [] };
    }

    const min = Math.max(0, Math.floor(Math.min(...values) / binSize) * binSize);
    const max = Math.ceil(Math.max(...values) / binSize) * binSize;
    const labels = [];
    const counts = [];

    for (let start = min; start < max; start += binSize) {
        const end = start + binSize;
        labels.push(`${start}-${end} min`);
        const count = values.filter(value => value >= start && (value < end || (end === max && value <= end))).length;
        counts.push(count);
    }

    return { labels, counts };
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
        .map(record => record.timeMinutes)
        .filter(value => typeof value === 'number' && !Number.isNaN(value));

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

const renderYearTrendChart = (data) => {
    const canvas = document.getElementById('yearTrendChart');
    if (!canvas) return;

    if (yearTrendChartInstance) {
        yearTrendChartInstance.destroy();
        yearTrendChartInstance = null;
    }

    if (!data.length) return;

    yearTrendChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: data.map(item => item.year),
            datasets: [{
                label: 'Participantes únicos',
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

const renderInsightList = (containerId, items, formatter, emptyMessage) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    if (!items.length) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'text-gray-400';
        emptyItem.textContent = emptyMessage;
        container.appendChild(emptyItem);
        return;
    }

    items.forEach((item, index) => {
        const listItem = document.createElement('li');
        listItem.className = 'flex items-start gap-3';

        const badge = document.createElement('span');
        badge.className = 'flex h-7 w-7 items-center justify-center rounded-full bg-green-900/40 text-green-300 text-xs font-semibold';
        badge.textContent = index + 1;

        const content = document.createElement('div');
        content.className = 'flex-1 space-y-1';
        content.innerHTML = formatter(item);

        listItem.appendChild(badge);
        listItem.appendChild(content);
        container.appendChild(listItem);
    });
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
            fetchJson('./assets/data/history_results.json')
        ]);

        const normalizedRecords = rawResults
            .map(normalizeRecordForStats)
            .filter(Boolean);

        const uniqueParticipantsData = aggregateUniqueParticipantsByDistance(normalizedRecords);
        renderDistanceParticipantsChart(uniqueParticipantsData);

        const genderDistribution = aggregateGenderDistribution(normalizedRecords);
        genderSummaryChartInstance = renderGenderSummaryChart(genderDistribution, 'genderSummaryChart', genderSummaryChartInstance);

        const totalUniqueParticipants = new Set(normalizedRecords.map(record => record.participantKey)).size;
        setTextContent('chronology-participants-count', totalUniqueParticipants || '0');

        const topEvents = aggregateTopEventsByParticipants(normalizedRecords, 3);
        renderInsightList(
            'topEventsList',
            topEvents,
            item => `
                <p class="font-semibold">${item.event}</p>
                <p class="text-xs text-gray-400">${item.year} · ${item.count} atletas únicos</p>
            `,
            'Aún no hay eventos con registros suficientes.'
        );

        const topCategories = aggregateTopCategories(normalizedRecords, 3);
        renderInsightList(
            'topCategoriesList',
            topCategories,
            item => `
                <p class="font-semibold">${item.category}</p>
                <p class="text-xs text-gray-400">${item.count} participaciones históricas</p>
            `,
            'No se encontraron categorías con actividad.'
        );

        const fastestMarks = findFastestPerformances(normalizedRecords, 3);
        renderInsightList(
            'fastestMarksList',
            fastestMarks,
            item => `
                <p class="font-semibold">${item.timeLabel}</p>
                <p class="text-xs text-gray-400">${item.name} · ${item.distance} · ${item.gender}</p>
            `,
            'Sin tiempos registrados para mostrar.'
        );

        const yearlyData = aggregateParticipantsByYear(normalizedRecords);
        renderYearTrendChart(yearlyData);

        const oneKRecords = normalizedRecords.filter(record => record.distance === '1K');
        const oneKParticipantsSet = new Set(oneKRecords.map(record => record.participantKey));
        setTextContent('oneKParticipantsCount', oneKParticipantsSet.size || '0');

        const oneKGenderDistribution = aggregateGenderDistribution(oneKRecords);
        oneKGenderChartInstance = renderGenderSummaryChart(oneKGenderDistribution, 'oneKGenderChart', oneKGenderChartInstance);

        const oneKAgeDistribution = aggregateAgeDistribution(oneKRecords);
        renderOneKAgeChart(oneKAgeDistribution);

        const oneKGenderFilter = document.getElementById('oneKGenderFilter');
        const oneKAgeFilter = document.getElementById('oneKAgeFilter');
        const oneKTimeStatus = document.getElementById('oneKTimeStatus');

        if (oneKRecords.length > 0) {
            const genderOptions = Array.from(new Set(oneKRecords.map(record => record.gender))).filter(Boolean).sort();
            populateSelect(
                'oneKGenderFilter',
                genderOptions.map(value => ({ value, label: value })),
                'Todos los géneros',
                option => option.value,
                option => option.label
            );

            const ageOptions = Array.from(new Set(oneKRecords.map(record => record.ageGroup))).filter(Boolean).sort();
            populateSelect(
                'oneKAgeFilter',
                ageOptions.map(value => ({ value, label: value })),
                'Todas las edades',
                option => option.value,
                option => option.label
            );
        } else {
            if (oneKGenderFilter) {
                oneKGenderFilter.innerHTML = '<option value="">Sin datos disponibles</option>';
                oneKGenderFilter.disabled = true;
            }
            if (oneKAgeFilter) {
                oneKAgeFilter.innerHTML = '<option value="">Sin datos disponibles</option>';
                oneKAgeFilter.disabled = true;
            }
        }

        const applyOneKFilters = () => {
            if (!oneKRecords.length) {
                renderOneKTimeChart([], oneKTimeStatus);
                return;
            }

            const genderValue = oneKGenderFilter ? normalizeText(oneKGenderFilter.value) : '';
            const ageValue = oneKAgeFilter ? oneKAgeFilter.value : '';

            const filtered = oneKRecords.filter(record => {
                const genderMatches = !genderValue || normalizeText(record.gender) === genderValue;
                const ageMatches = !ageValue || record.ageGroup === ageValue;
                return genderMatches && ageMatches;
            });

            renderOneKTimeChart(filtered, oneKTimeStatus);
        };

        if (oneKGenderFilter) {
            oneKGenderFilter.addEventListener('change', applyOneKFilters);
        }

        if (oneKAgeFilter) {
            oneKAgeFilter.addEventListener('change', applyOneKFilters);
        }

        applyOneKFilters();

        populateSelect('edition', events, 'Selecciona un evento', event => event.name, event => event.name);
        populateSelect('gender', genders, 'Selecciona un sexo', gender => gender.raw, gender => gender.raw);
        populateSelect('category', distances, 'Selecciona una distancia', distance => distance.label, distance => `${distance.label} (${distance.km} km)`);

        const counts = indexData?.counts || {};
        setTextContent('chronology-events-count', counts.events || events.length);
        setTextContent('chronology-distances-count', counts.distances || distances.length);
        setTextContent('chronology-genders-count', counts.genders || genders.length);

        renderAgeChart(ageGroups);
        renderDistanceChart(normalizedRecords);
    } catch (error) {
        console.error('Error al inicializar cronología:', error);
        dashboard.insertAdjacentElement('beforebegin', createEmptyState('No se pudieron cargar los datos de cronología.'));
    }
}
