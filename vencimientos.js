const UMBRALES_SEMAFORO = { ROJO: 90, AMARILLO: 180 };
const supabaseUrl = 'https://falivfgdcqglihwkogvp.supabase.co';
const supabaseKey = 'sb_publishable_3W0pALYuAuT75HQG4Upd6A_0odpQzau';
const clienteSupabase = window.supabase.createClient(supabaseUrl, supabaseKey);

function evaluarSemaforo(diasRestantes) {
    if (diasRestantes < UMBRALES_SEMAFORO.ROJO) return { texto: '🔴 Crítico / Vencido', clase: 'estado-rojo', valorRiesgo: 'rojo' };
    if (diasRestantes <= UMBRALES_SEMAFORO.AMARILLO) return { texto: '🟡 Próximo a vencer', clase: 'estado-amarillo', valorRiesgo: 'amarillo' };
    return { texto: '🟢 Vigente', clase: 'estado-verde', valorRiesgo: 'verde' };
}

async function cargarAlertas() {
    const { data, error } = await clienteSupabase.from('vista_vencimientos').select('*');
    if (error) { console.error('Error:', error); return; }
    const tbody = document.getElementById('tabla-cuerpo-vencimientos');
    tbody.innerHTML = '';
    if(data) {
        data.forEach(item => {
            const estado = evaluarSemaforo(item.dias_restantes);
            const tr = document.createElement('tr');
            tr.setAttribute('data-riesgo', estado.valorRiesgo);
            tr.innerHTML = `<td>${item.sucursal}</td><td>${item.medicamento}</td><td>${item.lote}</td><td>${item.fecha_vencimiento}</td><td>${item.dias_restantes}</td><td>${item.stock}</td><td class="${estado.clase}">${estado.texto}</td>`;
            tbody.appendChild(tr);
        });
    }
}

document.getElementById('filtro-riesgo').addEventListener('change', (e) => {
    const filtro = e.target.value;
    document.querySelectorAll('#tabla-cuerpo-vencimientos tr').forEach(fila => {
        fila.style.display = (filtro === 'todos' || fila.getAttribute('data-riesgo') === filtro) ? '' : 'none';
    });
});

document.getElementById('btn-generar-reporte').addEventListener('click', () => {
    const elemento = document.querySelector('.dashboard-container');
    html2pdf().set({ margin: 0.5, filename: 'Reporte_Vencimientos.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' } }).from(elemento).save();
});

cargarAlertas();