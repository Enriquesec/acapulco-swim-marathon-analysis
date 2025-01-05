document.addEventListener('DOMContentLoaded', () => {
    const links = document.querySelectorAll('nav a'); // Selecciona todos los enlaces del nav
    const contentDiv = document.getElementById('content'); // Contenedor donde se cargará el contenido

    links.forEach(link => {
        link.addEventListener('click', async (event) => {
            event.preventDefault(); // Evita que el navegador siga el enlace

            const targetFile = link.getAttribute('data-target'); // Obtén el archivo HTML a cargar

            try {
                // Usa fetch para cargar el archivo HTML
                const response = await fetch(targetFile);
                if (response.ok) {
                    const content = await response.text(); // Convierte la respuesta a texto
                    contentDiv.innerHTML = content; // Inserta el contenido en el div

                    // Si el contenido incluye un canvas para un gráfico, inicialízalo aquí
                    const activityCanvas = document.getElementById('activityChart');
                    if (activityCanvas) {
                        const activityCtx = activityCanvas.getContext('2d');
                        new Chart(activityCtx, {
                            type: 'line',
                            data: {
                                labels: ['Día 1', 'Día 2', 'Día 3', 'Día 4', 'Día 5'], // Etiquetas de ejemplo
                                datasets: [{
                                    label: 'Requests',
                                    data: [100, 200, 150, 300, 250], // Datos de ejemplo
                                    borderColor: '#00ff6a',
                                    backgroundColor: 'rgba(0, 255, 106, 0.2)',
                                    fill: true,
                                }]
                            },
                            options: {
                                responsive: true,
                                plugins: {
                                    legend: { display: false },
                                },
                            },
                        });
                    }
                } else {
                    contentDiv.innerHTML = `<p>Error ${response.status}: No se pudo cargar el contenido.</p>`;
                }
            } catch (error) {
                contentDiv.innerHTML = `<p>Error: ${error.message}</p>`;
            }
        });
    });
});

document.getElementById('applyFilters').addEventListener('click', () => {
    const edition = document.getElementById('edition').value;
    const gender = document.getElementById('gender').value;
    const category = document.getElementById('category').value;

    console.log('Edición seleccionada:', edition);
    console.log('Sexo seleccionado:', gender);
    console.log('Categoría seleccionada:', category);

    // Aquí puedes filtrar los datos según los valores seleccionados
});

