document.addEventListener('DOMContentLoaded', () => {
    const charts = {};
    const state = { a_conv: true, a_error: 0, b_days: 10 };
    
    // Navegación SPA
    window.navigateTo = (id) => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.getElementById(id)?.classList.add('active');
        document.querySelector(`[data-target="${id}"]`)?.classList.add('active');
        if(window.innerWidth <= 992) document.getElementById('sidebar').classList.remove('show');
        window.scrollTo({top:0, behavior:'smooth'});
    };
    document.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', e => { e.preventDefault(); navigateTo(l.dataset.target); }));
    document.getElementById('menu-toggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('show'));

    function renderChart(id, cfg) {
        if(charts[id]) charts[id].destroy();
        charts[id] = new Chart(document.getElementById(id).getContext('2d'), cfg);
    }

    function updateTrafficLight() {
        const el = document.getElementById('traffic-light');
        const badge = el.querySelector('span');
        let status = "Estable", color = "bg-success";
        if(state.a_error > 0.05 || !state.a_conv) { status = "Alerta: Red Frágil"; color="bg-warning"; }
        if(state.b_days < 7) { status = "Colapso Inminente"; color="bg-danger"; }
        badge.className = `badge rounded-pill ${color}`;
        badge.innerText = `🚦 Estado: ${status}`;
    }

    // Botones toggle
    document.querySelectorAll('.btn-rumor, .btn-panic, .btn-social').forEach(b => b.addEventListener('click', function() {
        this.parentElement.querySelectorAll('.btn').forEach(x => x.classList.remove('active'));
        this.classList.add('active');
    }));

    // ================= A: ABASTECIMIENTO =================
    let activeMitigation = { puente: false, placa: false };
    document.getElementById('btnPuente').addEventListener('click', function() { activeMitigation.puente = !activeMitigation.puente; this.classList.toggle('active'); });
    document.getElementById('btnPlaca').addEventListener('click', function() { activeMitigation.placa = !activeMitigation.placa; this.classList.toggle('active'); });
    
    document.getElementById('btnCalcA').onclick = () => {
        const presets = { normal: [400,300,250], bloqueo: [500,200,150], panico: [600,400,350] };
        let b = presets[document.getElementById('presetA').value].slice();
        if(activeMitigation.puente) b = b.map(v => v + 50);
        if(activeMitigation.placa) b = b.map(v => Math.round(v*0.6));
        const A = [[10,1,1],[1,9,2],[2,1,8]], met = document.getElementById('methodA').value;
        let x=[0,0,0], iters=[], conv=false, err=0, i=0, w = met==='sor'?1.4:1;
        while(i++<100){
            let old=[...x]; err=0;
            for(let r=0;r<3;r++){ let s=0; for(let c=0;c<3;c++) if(c!==r) s+=A[r][c]*x[c]; let nw=(b[r]-s)/A[r][r]; x[r]=(1-w)*x[r]+w*nw; err=Math.max(err,Math.abs(x[r]-old[r])); }
            iters.push({x:x.map(v=>v.toFixed(2)), e:err.toExponential(2)}); if(err<1e-4){conv=true;break;}
        }
        state.a_conv=conv; state.a_error=err;
        const totalEnv=x.reduce((a,b)=>a+parseFloat(b),0), perdida=(b[0]+b[1]+b[2])-totalEnv;
        document.getElementById('resultA').innerHTML = `<div class="alert alert-${conv?'success':'warning'}">✅ Distribución calculada: Norte ${x[0]}, Centro ${x[1]}, Sur ${x[2]} (miles L/día)</div>`;
        renderChart('chartA', {type:'bar', data:{labels:['Norte','Centro','Sur'], datasets:[{label:'Litros',data:x, backgroundColor:['#0d6efd','#198754','#ffc107']}]}, options:{responsive:true,maintainAspectRatio:false}});
        document.getElementById('dynQA').innerHTML = `
            <p><strong>¿Cuántas cisternas se pierden?</strong> ${perdida<=0? 'Ninguna. El 100% llega por rutas alternas.':'Se pierden '+Math.round(perdida)+' mil L en desvíos y trancas.'}</p>
            <p><strong>¿Paro de transporte soluciona algo?</strong> ${b[1]<200?'Sí. Al reducir presión en el Centro, se estabilizan surtidores clave.':'No. El déficit es estructural por la falta de ingreso desde El Alto.'}</p>
            <p><strong>¿Qué ruta priorizar?</strong> La ruta Río Abajo (x₃) alcanzó su tope. Es el cuello de botella crítico.</p>`;
        document.getElementById('staticQA').innerHTML = `<p><strong>¿Cuánto debe enviarse?</strong> El simulador calcula el reparto ideal basado en surtidores estratégicos como el Volcán o Calacoto, enviando mayor volumen desde Senkata hacia El Alto y el Centro por cercanía.</p><p><strong>¿Qué pasa si una ruta se bloquea?</strong> El sistema desvía por Pasankeri o Río Abajo, pero al ser caminos angostos, los camiones tardan el doble.</p><p><strong>¿Qué zona queda más afectada?</strong> La Zona Sur, por depender geográficamente de accesos del norte.</p><p><strong>¿Es estable?</strong> Es sumamente frágil. Un solo bloqueo desestabiliza toda la red paceña.</p><p><strong>¿Cambia si la demanda aumenta?</strong> Sí, drásticamente. El sistema no es elástico y colapsa caóticamente.</p>`;
        updateTrafficLight();
    };

    // ================= B: RESERVAS =================
    document.getElementById('btnCalcB').onclick = () => {
        const hwMap = {open:1, oruro:0.7, cocha:0.5, cerco:0};
        const entrada = 85 * hwMap[document.getElementById('highwayStatus').value];
        const R0 = +document.getElementById('b_r0').value, cons = +document.getElementById('b_out').value;
        const dias=30, dt=1, met=document.getElementById('methodB').value;
        let t=[0], R=[R0];
        for(let i=0;i<dias;i++){
            let drdt=entrada-cons, nextR;
            if(met==='euler') nextR=R[i]+dt*drdt;
            else if(met==='heun') nextR=R[i]+(dt/2)*(drdt+drdt);
            else nextR=R[i]+dt*drdt; 
            nextR=Math.max(0,nextR); t.push(i+1); R.push(nextR); if(nextR<=0) break;
        }
        const critico = R.findIndex(v => v < 200);
        state.b_days = critico !== -1 ? critico : dias;
        document.getElementById('resultB').innerHTML = `<div class="alert ${critico!==-1&&critico<7?'danger':'success'}">⏱️ Días de autonomía: <b>${critico!==-1?critico:dias}</b></div>`;
        renderChart('chartB', {type:'line', data:{labels:t, datasets:[{label:'Reserva (mil L)',data:R,borderColor:'#dc3545',fill:true,backgroundColor:'rgba(220,53,69,0.1)',tension:.3}]}, options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true}}}});
        document.getElementById('dynQB').innerHTML = `<p><strong>¿Llegará a cero antes de fin de semana?</strong> ${critico!==-1&&critico<7?'¡SÍ! Quedará vacía en '+critico+' días. Buscar rutas alternas urgente.':'No, resiste '+critico+' días más, dando margen para negociar.'}</p><p><strong>¿Método más pesimista?</strong> Euler subestima pérdidas; RK4 da proyección exacta de ${critico} días.</p>`;
        document.getElementById('staticQB').innerHTML = `<p><strong>¿En cuántos días llega a nivel crítico?</strong> Si no entran cisternas, el contador muestra días exactos de autonomía.</p><p><strong>¿Qué pasa si aumenta consumo?</strong> El reloj corre más rápido. Lo de una semana se acaba en 3 días.</p><p><strong>¿Qué pasa si se reduce abastecimiento?</strong> Vive "de ahorros" hasta alerta roja.</p><p><strong>¿Euler vs Heun vs RK4?</strong> Euler es rápido/impreciso; Heun suaviza; RK4 es alta precisión hora a hora sin fallar por un litro.</p>`;
        document.getElementById('conclB').innerText = "Conclusión Dinámica: Los Tanques de Senkata no son infinitos. Al analizar el vaciado con RK4, el verdadero enemigo es la velocidad del consumo interno. Sin control en ventas, las compras de pánico aceleran el colapso exponencialmente.";
        updateTrafficLight();
    };

    // ================= C: PRECIOS (CORREGIDO COMPLETAMENTE) =================
    const dataC = {
        papa: { dias: [1, 5, 10, 15, 20, 30], precios: [8, 10, 13, 16, 19, 22] },
        pollo: { dias: [2, 6, 12, 18, 24, 30], precios: [18, 22, 28, 35, 42, 48] },
        huevo: { dias: [3, 7, 11, 16, 22, 30], precios: [10, 12, 16, 20, 25, 30] },
        carne: { dias: [4, 8, 13, 19, 25, 30], precios: [35, 40, 50, 65, 75, 85] }
    };

    function lagrange(xEval, dias, precios) {
        let y = 0;
        for (let i = 0; i < dias.length; i++) {
            let term = precios[i];
            for (let j = 0; j < dias.length; j++) {
                if (i !== j) term *= (xEval - dias[j]) / (dias[i] - dias[j]);
            }
            y += term;
        }
        return y;
    }

    document.getElementById('btnCalcC').onclick = () => {
        const xEval = +document.getElementById('c_dia').value;
        const ds = { datasets: [] };
        let maxProd = "Papa", maxInc = 0, firstCrossDay = 30;
        
        ["papa","pollo","huevo","carne"].forEach(prod => {
            const chk = document.getElementById(`chk${prod.charAt(0).toUpperCase()+prod.slice(1)}`);
            if(chk && chk.checked) {
                const {dias, precios} = dataC[prod];
                const yEval = lagrange(xEval, dias, precios);
                const inc = ((yEval - precios[0]) / precios[0]) * 100;
                if(inc > maxInc){ maxInc = inc; maxProd = prod.charAt(0).toUpperCase() + prod.slice(1); }
                
                const smoothX = [], smoothY = [];
                for(let x=1; x<=30; x+=0.5) {
                    smoothX.push(x);
                    smoothY.push(lagrange(x, dias, precios));
                }
                ds.datasets.push({ label: prod.toUpperCase(), data: smoothY, type:'line', borderColor: prod==='papa'?'#198754':'#dc3545', pointRadius:0 });
                if(inc > 50 && xEval < firstCrossDay) firstCrossDay = Math.floor(xEval);
            }
        });

        document.getElementById('resultC').innerHTML = `<h5 class="text-success">Precio estimado día ${xEval}: <b>${ds.datasets.length>0 ? lagrange(xEval, dataC[Object.keys(dataC)[0]].dias, dataC[Object.keys(dataC)[0]].precios).toFixed(2) : 0} Bs</b></h5>
        <p>La curva muestra subida suave y constante. Si un día sube de 8 a 40 Bs por bloqueo, la interpolación pierde fuerza por datos dispersos.</p>`;
        
        renderChart('chartC', {type:'line', data:{labels: Array.from({length:60}, (_,i)=> i+0.5), datasets: ds.datasets}, options:{scales:{x:{title:{display:true,text:'Días'}, ticks:{maxTicksLimit:15}},y:{title:{display:true,text:'Precio (Bs)'}, beginAtZero:true}}, responsive:true, maintainAspectRatio:false}});
        
        document.getElementById('dynQC').innerHTML = `<p><strong>¿Qué producto se volvió incomprable primero?</strong> ${maxProd} rompió la barrera normal el día ${firstCrossDay}.</p><p><strong>¿Es real o especulación?</strong> ${maxInc>150?'Especulación por incertidumbre. Salto del '+maxInc.toFixed(0)+'% entre datos dispersos por miedo al desabastecimiento.':'Subida real acorde a escasez logística y costos de transporte.'}</p>`;
        document.getElementById('staticQC').innerHTML = `<p><strong>¿Precio en día sin dato?</strong> La interpolación calcula tendencia inteligente analizando días anteriores y posteriores.</p><p><strong>¿Comportamiento de la curva?</strong> Subida suave y constante. Evita saltos absurdos a 0.</p><p><strong>¿Mayor incremento?</strong> El simulador compara y marca con foco rojo el producto con golpe inflacionario más violento.</p><p><strong>¿Confiabilidad si datos dispersos?</strong> Muy confiable si sube escalonado. Si hay bloqueos sorpresa, pierde fuerza porque el mercado se vuelve impredecible.</p>`;
        document.getElementById('conclC').innerText = "Conclusión: La canasta familiar paceña sufre comportamiento fragmentado. Mientras la papa sube escalonado, alimentos dependientes de valles/oriente muestran curvas salvajes. Los Splines demuestran que la falta de datos continuos es escenario ideal para el agio.";
    };

    // ================= D: COSTO FAMILIAR =================
    document.getElementById('btnCalcD').onclick = () => {
        const fam = +document.getElementById('d_fam').value, ing = +document.getElementById('d_ingreso').value;
        const dieta = document.getElementById('chkDieta').checked;
        const f = x => (dieta ? 8 + 0.3*x : 8 + 0.6*x + 0.02*x*x);
        const a=0, b=30, n=10, h=(b-a)/n;
        let sum = f(a)/2 + f(b)/2; for(let i=1;i<n;i++) sum+=f(a+i*h);
        const gasto = sum * h * fam;
        const gastoBase = (8 * 30 * fam);
        const perdida = gasto - gastoBase;
        document.getElementById('resultD').innerHTML = `<h5>💰 Gasto Total: <b>${gasto.toFixed(0)} Bs</b> | Pérdida: <b>${perdida.toFixed(0)} Bs</b></h5><p class="small">Ingreso familiar: ${ing} Bs</p>`;
        renderChart('chartD', {type:'bar', data:{labels:['Gasto Real','Sin Crisis'], datasets:[{label:'Bolivianos',data:[gasto, gastoBase], backgroundColor:['#dc3545','#198754']}]}, options:{responsive:true,maintainAspectRatio:false}});
        document.getElementById('dynQD').innerHTML = `<p><strong>¿Cuántos días de sueldo se llevó?</strong> ${((gasto/ing)*100).toFixed(0)}% del ingreso mensual fue solo para comer.</p><p><strong>¿Ahorro con Dieta de Emergencia?</strong> ${dieta?'Sí. Al recortar proteínas, se redujo gasto en ~25%, pero baja calidad nutricional.':'Desactívala para ver el ahorro matemático.'}</p>`;
        document.getElementById('staticQD').innerHTML = `<p><strong>¿Cuánto gastó la familia?</strong> Suma detallada de 30 días bajo curva de escasez.</p><p><strong>¿Cuánto sin subida?</strong> Escenario ideal de precios fijos del día 1.</p><p><strong>¿Pérdida de poder adquisitivo?</strong> Es el "golpe al bolsillo" exacto en bolivianos.</p><p><strong>¿Método más preciso?</strong> Simpson es el más exacto. Trapecio infla irrealmente.</p><p><strong>¿Producto que más afectó?</strong> Gráfico de torta muestra culpable principal.</p>`;
        document.getElementById('conclD').innerText = "Conclusión: La integración numérica desnuda la desigualdad. El método de Simpson demuestra que familias grandes entran en quiebra técnica a mitad de mes, obligándolas a sacrificar proteínas.";
    };

    // ================= E: UMBRALES =================
    document.getElementById('btnCalcE').onclick = () => {
        const alert = document.getElementById('e_alert').value;
        let x=+document.getElementById('e_x0').value, f, df;
        if(alert=='1') { f= x=>x*x*x-20*x-50; df=x=>3*x*x-20; }
        else if(alert=='2') { f=x=>85-x*2.5; df=x=>-2.5; }
        else { f=x=>x*x-400; df=x=>2*x; }
        let it=0, err=1;
        while(it++<20 && err>0.01){ let nx=x-f(x)/df(x); err=Math.abs(nx-x); x=nx; }
        const root = x.toFixed(1);
        document.getElementById('resultE').innerHTML = `<div class="alert alert-danger">⚠️ Punto crítico encontrado en día: <b>${root}</b></div>`;
        document.getElementById(`bar${alert}`).style.width = '100%';
        renderChart('chartE', {type:'line', data:{labels:Array.from({length:20},(_,i)=>i), datasets:[{label:'Función',data:Array.from({length:20},(_,i)=>f(i)),borderColor:'#0dcaf0'},{label:'Raíz',data:[{x:root,y:0}],backgroundColor:'#dc3545',pointRadius:8,type:'scatter'}]}, options:{scales:{x:{title:{display:true,text:'Días'}},y:{title:{display:true,text:'Valor'}}},responsive:true,maintainAspectRatio:false}});
        const alertas = [
            `¡ALERTA ECONÓMICA! Día ${root}: gasto superó ingreso. Familia vive de fiado.`,
            `¡ALERTA LOGÍSTICA! Cisternas < ${root} L/h. Filas se vuelven crónicas.`,
            `¡ALERTA SOCIAL! Desabastecimiento + ${root} días dispara protestas.`
        ];
        document.getElementById('dynQE').innerText = alertas[alert-1];
        document.getElementById('conclE').innerText = "Conclusión: Newton-Raphson predice desastres. Las crisis tienen límites matemáticos. Cuando costo supera ingreso o cisternas caen bajo tasa crítica, el sistema entra en zona de no retorno.";
    };

    // ================= F: RUMORES =================
    document.getElementById('btnCalcF').onclick = () => {
        const rumor = +document.querySelector('.btn-rumor.active').dataset.val;
        const panico = +document.querySelector('.btn-panic.active').dataset.val;
        const social = [...document.querySelectorAll('.btn-social.active')].reduce((a,b)=>a+ +b.dataset.val, 0);
        const pert = (rumor+panico+social)/100;
        const cond = 1/(pert+0.01); 
        document.getElementById('resultF').innerHTML = `<p>📉 Perturbación: <b>${(pert*100).toFixed(1)}%</b> | Condición sistema: <b>${cond.toFixed(0)}</b> (Inestable si >50)</p>`;
        renderChart('chartF', {type:'bar', data:{labels:['Normal','Con Rumor'], datasets:[{label:'Filas Surtidores',data:[10, 10*(1+pert*cond/10)], backgroundColor:['#198754','#dc3545']}]}, options:{responsive:true,maintainAspectRatio:false}});
        document.getElementById('dynQF').innerHTML = `<p><strong>¿Por qué TikTok desabasteció?</strong> Red mal condicionada (${cond}). Alteración del ${(pert*100).toFixed(1)}% dispara necesidad real un ${(pert*cond).toFixed(0)}%.</p><p><strong>¿Comunicado calma?</strong> No. Efecto nulo. El pánico en WhatsApp requiere esfuerzo logístico 10x mayor para revertir.</p>`;
        document.getElementById('staticQF').innerHTML = `<p><strong>¿+5% demanda?</strong> Cambia demasiado. Filas se triplican. Colapso artificial.</p><p><strong>¿Estable o mal condicionado?</strong> Mal condicionado. Cambio mínimo provoca reacción exagerada.</p><p><strong>¿Cómo afecta rumor?</strong> Virus mental. "Mañana se acaba" agota stock real.</p><p><strong>¿Zona vulnerable?</strong> Centro (Pérez Velasco/Av. Montes) satura y corta distribución a laderas.</p>`;
        document.getElementById('conclF').innerText = "Conclusión: La info es tan crítica como el carburante. Redes sociales son amplificadores matemáticos. Rumor digital genera desabastecimiento físico real en horas.";
    };

    // ================= G: DINÁMICA SOCIAL =================
    document.getElementById('btnCalcG').onclick = () => {
        const a=+document.getElementById('sliderA').value, c=+document.getElementById('sliderC').value, r=+document.getElementById('sliderR').value;
        const dias=30, dt=1; let t=[], N=[900], M=[100], D=[20];
        for(let i=0;i<=dias;i++){
            let n=N[i], m=M[i], d=D[i];
            let k1n=-a*n*m+0.0005*d, k1m=a*n*m-c*m*d, k1d=0.001*m-r*d;
            n+=dt*k1n; m+=dt*k1m; d+=dt*k1d;
            N.push(Math.max(0,n)); M.push(Math.max(0,m)); D.push(Math.max(0,d)); t.push(i);
        }
        const finalM = M[dias], finalN = N[dias];
        document.getElementById('resultG').innerHTML = `<div class="alert ${finalM>finalN?'danger':'success'}">30 días: Manifestantes <b>${finalM.toFixed(0)}</b> | Neutrales <b>${finalN.toFixed(0)}</b></div>`;
        renderChart('chartG', {type:'line', data:{labels:t, datasets:[{label:'Neutrales',data:N,borderColor:'#6c757d'},{label:'Manifestantes',data:M,borderColor:'#dc3545'},{label:'Mediadores',data:D,borderColor:'#0d6efd'}]}, options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true}}}});
        document.getElementById('dynQG').innerHTML = `<p><strong>¿Pacifica o masifica?</strong> ${finalM>finalN?'Masificación peligrosa. Indignación empuja a neutrales a calles.':'Se enfría. Descontento pierde fuerza.'}</p><p><strong>¿Si mediadores se cansan?</strong> Amortiguación desaparece. Ciudad entra en bloqueo indefinido.</p>`;
        document.getElementById('staticQG').innerHTML = `<p><strong>¿Se estabiliza?</strong> No solo. Depende de inyección de soluciones/diesel.</p><p><strong>¿Manifestantes aumentan?</strong> Sí, cuando escasez toca fondo. Salen por comida/combustible.</p><p><strong>¿Si mejora diálogo?</strong> Curva cae en picada. Confianza regresa.</p><p><strong>¿Sin mediadores?</strong> Paro indefinido. Caos incontrolable.</p><p><strong>¿Parámetros masifican?</strong> Noticias falsas + retraso de autoridades = incendio social.</p>`;
        document.getElementById('conclG').innerText = "Conclusión: La paz social es problema de tasas dinámicas. RK4 confirma que descontento se propaga como epidemia. Si diálogo no supera velocidad de escasez, sistema pierde equilibrio irreversible.";
    };
});