document.addEventListener('DOMContentLoaded', () => {
    const links = document.querySelectorAll('nav a'); // Selecciona todos los enlaces del nav
    const contentDiv = document.getElementById('content'); // Contenedor donde se cargará el contenido
    
    const loadContent = async (targetFile) => {
        try {
            // Usa fetch para cargar el archivo HTML
            const response = await fetch(targetFile);
            if (response.ok) {
                const content = await response.text(); // Convierte la respuesta a texto
                contentDiv.innerHTML = content; // Inserta el contenido en el div
                initializeCharts(); // Llama a una función para inicializar los gráficos
                initializeEventListeners(); // Llama a una función para los nuevos listeners
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
});

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
}

function initializeCharts() {
    // El código para inicializar Chart.js que tenías antes va aquí.
    // Esto asegura que los gráficos se creen cada vez que se carga nuevo contenido.
}
