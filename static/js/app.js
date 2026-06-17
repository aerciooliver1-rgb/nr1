// ══════════════════════════════════════════════
//  DRPS NR-1 — Frontend Application
//  All data via Supabase JS client
// ══════════════════════════════════════════════

const SUPABASE_URL = 'https://jkwxlxpmzpghpbgodtgb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprd3hseHBtenBnaHBiZ29kdGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MDQzMTAsImV4cCI6MjA5NDM4MDMxMH0.wgyNjFD6ZJmvJAtyfbGJZgG3oQGvTcVUVijdB2GJvdA';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentCompanyId = null;
let currentAssessmentId = null;
let currentActionPlanId = null;
let factors = [];
let questions = [];
let currentFactorIndex = 0;
let assessmentResponses = {};
let factorObservations = {};
let riskChart = null;

const SCALE_LABELS = {
    frequency: ['Nunca', 'Raramente', 'Às vezes', 'Frequentemente', 'Sempre'],
    concordance: ['Discordo totalmente', 'Discordo', 'Neutro', 'Concordo', 'Concordo totalmente'],
    existencia: ['Inexistente', 'Precário', 'Parcial', 'Adequado', 'Excelente']
};

function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

function setLoading(btn, loading) {
    if (loading) {
        btn.dataset.origText = btn.textContent;
        btn.textContent = 'Aguarde...';
        btn.disabled = true;
    } else {
        btn.textContent = btn.dataset.origText || btn.textContent;
        btn.disabled = false;
    }
}

function formatCNPJ(v) {
    return v.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2').substring(0, 18);
}

// ══ Auth ══
function showSignup() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('signup-form').classList.remove('hidden');
}
function showLogin() {
    document.getElementById('signup-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
}

async function doLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    const btn = document.querySelector('#login-form .btn-primary');
    errEl.classList.add('hidden');
    setLoading(btn, true);
    try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        currentUser = data.user;
        enterApp();
    } catch (e) {
        errEl.textContent = e.message || 'E-mail ou senha incorretos';
        errEl.classList.remove('hidden');
    } finally { setLoading(btn, false); }
}

async function doSignup() {
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const errEl = document.getElementById('signup-error');
    errEl.classList.add('hidden');
    try {
        const { data, error } = await sb.auth.signUp({
            email, password,
            options: { data: { full_name: name } }
        });
        if (error) throw error;
        if (data.user && data.session) {
            await sb.from('profiles').upsert({ id: data.user.id, full_name: name });
            currentUser = data.user;
            enterApp();
        } else {
            toast('Conta criada! Verifique seu e-mail para confirmar.');
            showLogin();
        }
    } catch (e) {
        errEl.textContent = e.message || 'Erro ao criar conta';
        errEl.classList.remove('hidden');
    }
}

async function doLogout() {
    await sb.auth.signOut();
    currentUser = null;
    document.getElementById('app-layout').classList.add('hidden');
    const ls = document.getElementById('screen-login');
    ls.classList.add('active');
    ls.style.display = '';
}

function enterApp() {
    document.getElementById('screen-login').classList.remove('active');
    document.getElementById('screen-login').style.display = 'none';
    document.getElementById('app-layout').classList.remove('hidden');
    document.getElementById('user-email').textContent = currentUser?.email || '';
    document.getElementById('config-email').value = currentUser?.email || '';
    navigate('dashboard');
}

// ══ Navigation ══
function navigate(screen) {
    document.querySelectorAll('.main-content .screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(`screen-${screen}`);
    if (el) el.classList.add('active');
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
    const nav = document.querySelector(`.sidebar-nav a[data-screen="${screen}"]`);
    if (nav) nav.classList.add('active');

    const loaders = {
        dashboard: loadDashboard, empresas: loadEmpresas, 'empresa-form': loadEmpresaForm,
        'empresa-perfil': loadEmpresaPerfil, 'avaliacao-inicio': loadAvaliacaoInicio,
        questionario: loadQuestionario, revisao: loadRevisao, resultado: loadResultado,
        intervencoes: loadIntervencoes, catalogo: loadCatalogo, 'plano-acao': loadPlanoAcao,
        apresentacao: loadApresentacao, aprovacao: loadAprovacao, acompanhamento: loadAcompanhamento,
        avaliacoes: loadAvaliacoes, relatorios: loadRelatorios, reavaliacao: loadReavaliacao,
        configuracoes: loadConfiguracoes,
    };
    if (loaders[screen]) loaders[screen]();
}

// ══ T-02: Dashboard ══
async function loadDashboard() {
    try {
        const [{ count: totalCompanies }, { count: activeAssessments }, { count: completedAssessments }, { count: overdueActions }] = await Promise.all([
            sb.from('companies').select('id', { count: 'exact', head: true }),
            sb.from('assessments').select('id', { count: 'exact', head: true }).in('status', ['in_progress', 'coletando', 'review']),
            sb.from('assessments').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
            sb.from('action_items').select('id', { count: 'exact', head: true }).eq('status', 'atrasada'),
        ]);

        document.getElementById('dashboard-stats').innerHTML = `
            <div class="stat-card"><div class="stat-value">${totalCompanies||0}</div><div class="stat-label">Total de Empresas</div></div>
            <div class="stat-card warning"><div class="stat-value">${activeAssessments||0}</div><div class="stat-label">Avaliações em Andamento</div></div>
            <div class="stat-card success"><div class="stat-value">${completedAssessments||0}</div><div class="stat-label">Avaliações Concluídas</div></div>
            <div class="stat-card danger"><div class="stat-value">${overdueActions||0}</div><div class="stat-label">Ações Vencidas</div></div>`;

        const { data: companies } = await sb.from('companies').select('*, sectors(id, name, num_trabalhadores)').order('created_at', { ascending: false });

        if (!companies?.length) {
            document.getElementById('dashboard-companies').innerHTML = `
                <div class="empty-state"><div class="icon">🏢</div><h3>Nenhuma empresa cadastrada</h3>
                <p>Cadastre a primeira empresa para iniciar o diagnóstico.</p>
                <button class="btn btn-primary" onclick="navigate('empresa-form')">+ Cadastrar Empresa</button></div>`;
            return;
        }
        document.getElementById('dashboard-companies').innerHTML = `
            <table><thead><tr><th>Empresa</th><th>Setor Econômico</th><th>Porte</th><th>Setores</th><th>Ações</th></tr></thead>
            <tbody>${companies.map(c => `<tr>
                <td><strong>${c.name}</strong><br><small style="color:var(--text-light)">${c.cnpj||''}</small></td>
                <td>${c.setor_economico||'-'}</td><td>${c.porte||'-'}</td><td>${(c.sectors||[]).length}</td>
                <td><button class="btn btn-sm btn-secondary" onclick="viewCompany('${c.id}')">Ver perfil</button></td>
            </tr>`).join('')}</tbody></table>`;
    } catch (e) { toast(e.message, 'error'); }
}

// ══ T-03: Company Form ══
function loadEmpresaForm() {
    if (!document.getElementById('empresa-id').value) {
        document.getElementById('empresa-form-title').textContent = 'Cadastrar Empresa';
        ['empresa-name','empresa-cnpj','empresa-setor','empresa-porte','empresa-contato-nome','empresa-contato-email','empresa-contato-tel','empresa-obs'].forEach(id => { const e = document.getElementById(id); if(e) e.value = ''; });
        document.getElementById('empresa-grau').value = '1';
    }
}

async function saveCompany() {
    const id = document.getElementById('empresa-id').value;
    const d = {
        name: document.getElementById('empresa-name').value,
        cnpj: document.getElementById('empresa-cnpj').value || null,
        setor_economico: document.getElementById('empresa-setor').value || null,
        porte: document.getElementById('empresa-porte').value || null,
        grau_risco_nr4: parseInt(document.getElementById('empresa-grau').value),
        contato_nome: document.getElementById('empresa-contato-nome').value || null,
        contato_email: document.getElementById('empresa-contato-email').value || null,
        contato_telefone: document.getElementById('empresa-contato-tel').value || null,
        observacoes: document.getElementById('empresa-obs').value || null,
    };
    if (!d.name) { toast('Nome é obrigatório', 'error'); return; }
    const btn = document.querySelector('#screen-empresa-form .btn-primary');
    setLoading(btn, true);
    try {
        if (id) {
            await sb.from('companies').update(d).eq('id', id);
            toast('Empresa atualizada!');
        } else {
            d.created_by = currentUser.id;
            const { data, error } = await sb.from('companies').insert(d).select().single();
            if (error) throw error;
            currentCompanyId = data.id;
            await sb.from('company_users').insert({ company_id: data.id, user_id: currentUser.id, role: 'admin' });
            toast('Empresa cadastrada!');
        }
        document.getElementById('empresa-id').value = '';
        navigate('empresa-perfil');
    } catch (e) { toast(e.message, 'error'); } finally { setLoading(btn, false); }
}

async function loadEmpresas() {
    const { data } = await sb.from('companies').select('*').order('created_at', { ascending: false });
    if (!data?.length) {
        document.getElementById('empresas-list').innerHTML = '<div class="empty-state"><div class="icon">🏢</div><h3>Nenhuma empresa</h3><button class="btn btn-primary" onclick="navigate(\'empresa-form\')">+ Cadastrar</button></div>';
        return;
    }
    document.getElementById('empresas-list').innerHTML = `
        <table><thead><tr><th>Empresa</th><th>CNPJ</th><th>Setor</th><th>Porte</th><th>Grau NR-4</th><th></th></tr></thead>
        <tbody>${data.map(c => `<tr><td><strong>${c.name}</strong></td><td>${c.cnpj||'-'}</td><td>${c.setor_economico||'-'}</td><td>${c.porte||'-'}</td><td>${c.grau_risco_nr4||'-'}</td><td><button class="btn btn-sm btn-secondary" onclick="viewCompany('${c.id}')">Ver</button></td></tr>`).join('')}</tbody></table>`;
}

function viewCompany(id) { currentCompanyId = id; navigate('empresa-perfil'); }

// ══ T-04/T-05: Company Profile & Sectors ══
async function loadEmpresaPerfil() {
    if (!currentCompanyId) { navigate('empresas'); return; }
    try {
        const [{ data: company }, { data: sectors }, { data: assessments }] = await Promise.all([
            sb.from('companies').select('*').eq('id', currentCompanyId).single(),
            sb.from('sectors').select('*').eq('company_id', currentCompanyId).order('created_at'),
            sb.from('assessments').select('*, sectors(name)').eq('company_id', currentCompanyId).order('created_at', { ascending: false }),
        ]);
        document.getElementById('perfil-empresa-name').textContent = company.name;
        const tw = (sectors||[]).reduce((s, sec) => s + (sec.num_trabalhadores || 0), 0);
        const cd = (assessments||[]).filter(a => a.status === 'completed').length;
        const ac = (assessments||[]).filter(a => ['in_progress','coletando','review'].includes(a.status)).length;

        document.getElementById('perfil-stats').innerHTML = `
            <div class="stat-card"><div class="stat-value">${(sectors||[]).length}</div><div class="stat-label">Setores</div></div>
            <div class="stat-card"><div class="stat-value">${tw}</div><div class="stat-label">Trabalhadores</div></div>
            <div class="stat-card success"><div class="stat-value">${cd}</div><div class="stat-label">Avaliações Concluídas</div></div>
            <div class="stat-card warning"><div class="stat-value">${ac}</div><div class="stat-label">Em Andamento</div></div>`;

        document.getElementById('sectors-table').innerHTML = !(sectors||[]).length
            ? '<div class="empty-state"><p>Nenhum setor cadastrado. Adicione setores para iniciar avaliações.</p></div>'
            : `<table><thead><tr><th>Setor</th><th>Trabalhadores</th><th>Gestor</th><th></th></tr></thead>
            <tbody>${sectors.map(s => `<tr><td><strong>${s.name}</strong></td><td>${s.num_trabalhadores||0}</td><td>${s.gestor_nome||'-'}</td><td><button class="btn btn-sm btn-danger" onclick="deleteSector('${s.id}')">Excluir</button></td></tr>`).join('')}</tbody></table>`;

        document.getElementById('empresa-assessments').innerHTML = !(assessments||[]).length
            ? '<div class="empty-state"><p>Nenhuma avaliação realizada</p></div>'
            : `<table><thead><tr><th>Setor</th><th>Ciclo</th><th>Modo</th><th>Status</th><th>Risco</th><th>Data</th><th></th></tr></thead>
            <tbody>${assessments.map(a => `<tr>
                <td>${a.sectors?.name||'-'}</td><td>${a.cycle_number}º</td>
                <td>${a.mode==='anonimo'?'Survey Anônimo':'Institucional'}</td>
                <td><span class="badge badge-${a.status}">${fmtStatus(a.status)}</span></td>
                <td>${a.indice_risco_geral!=null?`<span class="badge badge-${a.nivel_risco_geral}">${Math.round(a.indice_risco_geral)}</span>`:'-'}</td>
                <td>${fmtDate(a.created_at)}</td>
                <td><button class="btn btn-sm btn-secondary" onclick="openAssessment('${a.id}','${a.status}')">Abrir</button></td>
            </tr>`).join('')}</tbody></table>`;
    } catch (e) { toast(e.message, 'error'); }
}

function showAddSector() { document.getElementById('sector-add-form').classList.remove('hidden'); }
function hideAddSector() { document.getElementById('sector-add-form').classList.add('hidden'); }

async function saveSector() {
    const name = document.getElementById('sector-name').value;
    if (!name) { toast('Nome obrigatório', 'error'); return; }
    const { error } = await sb.from('sectors').insert({
        company_id: currentCompanyId, name,
        num_trabalhadores: parseInt(document.getElementById('sector-workers').value)||0,
        gestor_nome: document.getElementById('sector-gestor').value || null,
    });
    if (error) { toast(error.message, 'error'); return; }
    toast('Setor adicionado!');
    hideAddSector();
    document.getElementById('sector-name').value = '';
    document.getElementById('sector-workers').value = '0';
    document.getElementById('sector-gestor').value = '';
    loadEmpresaPerfil();
}

async function deleteSector(id) {
    if (!confirm('Excluir este setor?')) return;
    await sb.from('sectors').delete().eq('id', id);
    toast('Setor excluído'); loadEmpresaPerfil();
}

function startNewAssessment() { navigate('avaliacao-inicio'); }

// ══ T-06: Assessment Start ══
async function loadAvaliacaoInicio() {
    const { data: companies } = await sb.from('companies').select('id, name').order('name');
    const sel = document.getElementById('av-empresa');
    sel.innerHTML = '<option value="">Selecione...</option>' + (companies||[]).map(c => `<option value="${c.id}" ${c.id===currentCompanyId?'selected':''}>${c.name}</option>`).join('');
    if (currentCompanyId) loadSectorsForAssessment();
}

async function loadSectorsForAssessment() {
    const cid = document.getElementById('av-empresa').value;
    if (!cid) return;
    const { data } = await sb.from('sectors').select('id, name, num_trabalhadores').eq('company_id', cid);
    document.getElementById('av-setor').innerHTML = '<option value="">Selecione...</option>' + (data||[]).map(s => `<option value="${s.id}">${s.name} (${s.num_trabalhadores||0} trab.)</option>`).join('');
}

function toggleMode() {
    const m = document.querySelector('input[name="av-mode"]:checked').value;
    document.getElementById('modo-a-fields').classList.toggle('hidden', m !== 'institucional');
    document.getElementById('modo-b-fields').classList.toggle('hidden', m !== 'anonimo');
}

async function createAssessment() {
    const company_id = document.getElementById('av-empresa').value;
    const sector_id = document.getElementById('av-setor').value;
    const mode = document.querySelector('input[name="av-mode"]:checked').value;
    if (!company_id || !sector_id) { toast('Selecione empresa e setor', 'error'); return; }
    const btn = document.querySelector('#screen-avaliacao-inicio .btn-primary');
    setLoading(btn, true);

    const { data: existing } = await sb.from('assessments').select('cycle_number').eq('company_id', company_id).eq('sector_id', sector_id).order('cycle_number', { ascending: false }).limit(1);
    const cycle = existing?.length ? existing[0].cycle_number + 1 : 1;

    const token_convite = crypto.randomUUID().substring(0, 8);
    const rec = {
        company_id, sector_id, mode, cycle_number: cycle,
        created_by: currentUser.id, started_at: new Date().toISOString(),
        status: mode === 'institucional' ? 'in_progress' : 'coletando',
        respondente_nome: mode === 'institucional' ? document.getElementById('av-respondente-nome').value || null : null,
        respondente_cargo: mode === 'institucional' ? document.getElementById('av-respondente-cargo').value || null : null,
        minimo_respondentes: mode === 'anonimo' ? parseInt(document.getElementById('av-minimo').value)||5 : 5,
    };

    const { data, error } = await sb.from('assessments').insert(rec).select().single();
    if (error) { toast(error.message, 'error'); return; }

    currentAssessmentId = data.id;
    currentCompanyId = company_id;

    if (mode === 'anonimo') {
        const link = `/survey/${data.id}/${sector_id}/${token_convite}`;
        await sb.from('assessments').update({ link_survey: link }).eq('id', data.id);
        alert(`Link do survey anônimo:\n${window.location.origin}${link}\n\nCompartilhe com os trabalhadores do setor.`);
        setLoading(btn, false);
        navigate('empresa-perfil');
    } else {
        toast('Avaliação criada!');
        setLoading(btn, false);
        navigate('questionario');
    }
}

// ══ T-07: Questionnaire ══
async function loadQuestionario() {
    if (!currentAssessmentId) { navigate('dashboard'); return; }
    if (!factors.length) {
        const [{ data: f }, { data: q }] = await Promise.all([
            sb.from('factors').select('*').order('order_index'),
            sb.from('questions').select('*').order('factor_id').order('order_index'),
        ]);
        factors = f || [];
        questions = q || [];
    }
    const { data: existing } = await sb.from('assessment_responses').select('question_id, score').eq('assessment_id', currentAssessmentId);
    assessmentResponses = {};
    (existing||[]).forEach(r => { assessmentResponses[r.question_id] = r.score; });

    const { data: obs } = await sb.from('factor_observations').select('factor_id, observation').eq('assessment_id', currentAssessmentId);
    factorObservations = {};
    (obs||[]).forEach(o => { factorObservations[o.factor_id] = o.observation; });

    renderStepper(); renderFactor();
}

function renderStepper() {
    document.getElementById('quest-stepper').innerHTML = factors.map((f, i) => {
        const fq = questions.filter(q => q.factor_id === f.id);
        const done = fq.length > 0 && fq.every(q => assessmentResponses[q.id] !== undefined);
        return `<div class="stepper-item ${i===currentFactorIndex?'active':''} ${done?'completed':''}" onclick="goToFactor(${i})">
            <span class="step-num">${done?'✓':i+1}</span>${f.code}</div>`;
    }).join('');
}

function renderFactor() {
    const f = factors[currentFactorIndex];
    const fq = questions.filter(q => q.factor_id === f.id);
    document.getElementById('quest-factor-name').textContent = f.name;
    document.getElementById('quest-factor-code').textContent = f.code;

    const totalAns = Object.keys(assessmentResponses).length;
    const pct = Math.round((totalAns / questions.length) * 100);
    document.getElementById('quest-progress-bar').style.width = pct + '%';
    document.getElementById('quest-progress-text').textContent = `${totalAns}/${questions.length} questões (${pct}%)`;

    document.getElementById('quest-questions').innerHTML = fq.map(q => {
        const labels = SCALE_LABELS[q.scale_type] || SCALE_LABELS.concordance;
        return `<div class="likert-group">
            <div class="question-text"><strong>${q.question_code}</strong> — ${q.text}</div>
            <div class="likert-options">${labels.map((l, i) => `
                <label><input type="radio" name="q_${q.id}" value="${i+1}" ${assessmentResponses[q.id]==i+1?'checked':''} onchange="setResponse(${q.id},${i+1})"><span>${l}</span></label>
            `).join('')}</div></div>`;
    }).join('');

    document.getElementById('quest-observation').value = factorObservations[f.id] || '';
    document.getElementById('quest-prev').classList.toggle('hidden', currentFactorIndex === 0);
    document.getElementById('quest-next').textContent = currentFactorIndex === factors.length - 1 ? 'Finalizar → Revisão' : 'Próximo →';
    renderStepper();
}

function setResponse(qid, val) { assessmentResponses[qid] = val; }
function goToFactor(i) { saveCurrentFactor(); currentFactorIndex = i; renderFactor(); }

async function saveCurrentFactor() {
    const f = factors[currentFactorIndex];
    const fq = questions.filter(q => q.factor_id === f.id);

    for (const q of fq) {
        if (assessmentResponses[q.id] === undefined) continue;
        const val = assessmentResponses[q.id];
        const norm = q.reverse_scored ? ((5 - val) / 4) * 100 : ((val - 1) / 4) * 100;

        const { data: ex } = await sb.from('assessment_responses').select('id').eq('assessment_id', currentAssessmentId).eq('question_id', q.id).limit(1);
        if (ex?.length) {
            await sb.from('assessment_responses').update({ score: val, valor_normalizado: Math.round(norm * 100) / 100 }).eq('id', ex[0].id);
        } else {
            await sb.from('assessment_responses').insert({
                assessment_id: currentAssessmentId, question_id: q.id,
                score: val, valor_normalizado: Math.round(norm * 100) / 100,
                answered_by: currentUser.id,
            });
        }
    }

    const obs = document.getElementById('quest-observation').value;
    if (obs !== (factorObservations[f.id] || '')) {
        factorObservations[f.id] = obs;
        const { data: exo } = await sb.from('factor_observations').select('id').eq('assessment_id', currentAssessmentId).eq('factor_id', f.id);
        if (exo?.length) {
            await sb.from('factor_observations').update({ observation: obs }).eq('id', exo[0].id);
        } else {
            await sb.from('factor_observations').insert({ assessment_id: currentAssessmentId, factor_id: f.id, observation: obs });
        }
    }
}

async function nextFactor() {
    const f = factors[currentFactorIndex];
    const fq = questions.filter(q => q.factor_id === f.id);
    if (fq.some(q => !assessmentResponses[q.id])) { toast('Responda todas as questões deste fator', 'error'); return; }
    await saveCurrentFactor();
    if (currentFactorIndex < factors.length - 1) { currentFactorIndex++; renderFactor(); window.scrollTo(0,0); }
    else navigate('revisao');
}

async function prevFactor() {
    await saveCurrentFactor();
    if (currentFactorIndex > 0) { currentFactorIndex--; renderFactor(); window.scrollTo(0,0); }
}

// ══ T-08: Review ══
async function loadRevisao() {
    if (!currentAssessmentId) return;
    let missing = 0;
    let html = '';
    factors.forEach(f => {
        const fq = questions.filter(q => q.factor_id === f.id);
        const ans = fq.filter(q => assessmentResponses[q.id]).length;
        const m = fq.length - ans;
        missing += m;
        html += `<div class="accordion-item">
            <div class="accordion-header" onclick="toggleAccordion(this)">
                <span>${f.code} — ${f.name}</span>
                <span>${m>0?`<span class="badge badge-alto">${m} pendentes</span>`:'<span class="badge badge-concluida">Completo</span>'} <span class="arrow">▼</span></span>
            </div>
            <div class="accordion-body">
                <table><thead><tr><th>Questão</th><th>Resposta</th></tr></thead>
                <tbody>${fq.map(q => {
                    const v = assessmentResponses[q.id];
                    const lb = SCALE_LABELS[q.scale_type]||SCALE_LABELS.concordance;
                    return `<tr><td style="font-size:13px">${q.question_code}: ${q.text}</td>
                    <td>${v?`<span class="badge badge-${v<=2?'baixo':v<=3?'moderado':'alto'}">${lb[v-1]}</span>`:'<span class="badge badge-alto">Pendente</span>'}</td></tr>`;
                }).join('')}</tbody></table>
                ${factorObservations[f.id]?`<div style="margin-top:12px;padding:12px;background:#F5F7FA;border-radius:8px"><strong>Obs:</strong> ${factorObservations[f.id]}</div>`:''}
                <button class="btn btn-sm btn-secondary mt-16" onclick="goToFactor(${factors.indexOf(f)});navigate('questionario')">Editar</button>
            </div></div>`;
    });
    document.getElementById('revisao-alerts').innerHTML = missing > 0
        ? `<div class="alert alert-warning">${missing} questões pendentes</div>`
        : '<div class="alert alert-success">Todas as questões respondidas. Pronto para calcular.</div>';
    document.getElementById('revisao-content').innerHTML = html;
}

function toggleAccordion(el) { el.classList.toggle('open'); el.nextElementSibling.classList.toggle('open'); }

function showCalculateModal() {
    if (Object.keys(assessmentResponses).length < questions.length) { toast('Responda todas as questões', 'error'); return; }
    document.getElementById('modal-calculate').classList.add('active');
}
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

async function calculateDiagnosis() {
    closeModal('modal-calculate');
    try {
        const { data: responses } = await sb.from('assessment_responses').select('question_id, valor_normalizado, questions(factor_id)').eq('assessment_id', currentAssessmentId);

        const byFactor = {};
        (responses||[]).forEach(r => {
            const fid = r.questions.factor_id;
            if (!byFactor[fid]) byFactor[fid] = [];
            byFactor[fid].push(r.valor_normalizado);
        });

        await sb.from('risk_scores').delete().eq('assessment_id', currentAssessmentId);

        let totalScore = 0, count = 0;
        for (const [fid, scores] of Object.entries(byFactor)) {
            const raw = scores.reduce((a,b) => a+b, 0) / scores.length;
            let sev, cls;
            if (raw <= 25) { sev = 1; cls = 'baixo'; }
            else if (raw <= 50) { sev = 2; cls = 'moderado'; }
            else if (raw <= 75) { sev = 3; cls = 'alto'; }
            else { sev = 4; cls = 'critico'; }
            const prob = raw <= 20 ? 1 : raw <= 45 ? 2 : raw <= 70 ? 3 : 4;
            const final_score = Math.min(100, (sev * prob / 16) * 100);

            await sb.from('risk_scores').insert({
                assessment_id: currentAssessmentId, factor_id: parseInt(fid),
                raw_score: Math.round(raw*100)/100, severity: sev, probability: prob,
                final_score: Math.round(final_score*100)/100, classification: cls,
            });
            totalScore += final_score; count++;
        }

        const gen = count ? Math.round(totalScore/count*100)/100 : 0;
        const genLvl = gen <= 25 ? 'baixo' : gen <= 50 ? 'moderado' : gen <= 75 ? 'alto' : 'critico';

        await sb.from('assessments').update({
            indice_risco_geral: gen, nivel_risco_geral: genLvl,
            status: 'completed', completed_at: new Date().toISOString()
        }).eq('id', currentAssessmentId);

        toast('Diagnóstico calculado!');
        navigate('resultado');
    } catch (e) { toast(e.message, 'error'); }
}

// ══ T-09: Results ══
async function loadResultado() {
    if (!currentAssessmentId) return;
    try {
        const [{ data: assessment }, { data: riskScores }] = await Promise.all([
            sb.from('assessments').select('*, sectors(name)').eq('id', currentAssessmentId).single(),
            sb.from('risk_scores').select('*, factors(name, code, dimension, consequence)').eq('assessment_id', currentAssessmentId).order('final_score', { ascending: false }),
        ]);

        const lvl = assessment.nivel_risco_geral || 'baixo';
        const sc = Math.round(assessment.indice_risco_geral || 0);
        const labels = { baixo:'Baixo', moderado:'Moderado', alto:'Alto', critico:'Crítico' };

        document.getElementById('result-indicator').innerHTML = `
            <div class="risk-indicator ${lvl}"><div class="risk-score">${sc}</div>
            <div><div class="risk-label">${labels[lvl]}</div>
            <div style="font-size:14px;color:var(--text-light)">Índice Geral — ${assessment.sectors?.name||''}</div></div></div>`;

        if (riskChart) riskChart.destroy();
        const ctx = document.getElementById('risk-chart').getContext('2d');
        const colors = (riskScores||[]).map(r => r.classification==='critico'?'#880E4F':r.classification==='alto'?'#F44336':r.classification==='moderado'?'#FF9800':'#4CAF50');

        riskChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: (riskScores||[]).map(r => r.factors?.code||''), datasets: [{ label: 'Score', data: (riskScores||[]).map(r => Math.round(r.final_score)), backgroundColor: colors, borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Score (0-100)' } } }, plugins: { legend: { display: false } } }
        });

        document.getElementById('risk-ranking').innerHTML = `
            <table><thead><tr><th>#</th><th>Fator</th><th>Dimensão</th><th>Score</th><th>Nível</th><th>Consequência</th></tr></thead>
            <tbody>${(riskScores||[]).map((rs, i) => `<tr>
                <td>${i+1}</td><td><strong>${rs.factors?.code}</strong> — ${rs.factors?.name||''}</td>
                <td>${rs.factors?.dimension||''}</td>
                <td><div class="risk-bar" style="width:${Math.max(rs.final_score,10)}%;background:${colors[i]}">${Math.round(rs.final_score)}</div></td>
                <td><span class="badge badge-${rs.classification}">${rs.classification}</span></td>
                <td style="font-size:12px">${rs.factors?.consequence||''}</td>
            </tr>`).join('')}</tbody></table>`;
    } catch (e) { toast(e.message, 'error'); }
}

function openAssessment(id, status) {
    currentAssessmentId = id;
    currentFactorIndex = 0;
    assessmentResponses = {};
    factorObservations = {};
    if (status === 'completed') navigate('resultado');
    else if (status === 'in_progress') navigate('questionario');
    else navigate('resultado');
}

// ══ T-10: Interventions ══
async function loadIntervencoes() {
    if (!currentAssessmentId) return;
    const [{ data: riskScores }, { data: catalog }, { data: existing }] = await Promise.all([
        sb.from('risk_scores').select('*').eq('assessment_id', currentAssessmentId).order('final_score', { ascending: false }),
        sb.from('intervention_catalog').select('*'),
        sb.from('assessment_interventions').select('catalog_id').eq('assessment_id', currentAssessmentId),
    ]);
    const existIds = new Set((existing||[]).map(e => e.catalog_id));
    const lvlOrd = { critico: 4, alto: 3, moderado: 2, baixo: 1 };
    let suggestions = [];
    for (const rs of (riskScores||[])) {
        if (rs.classification === 'baixo') continue;
        for (const p of (catalog||[])) {
            if ((p.target_factor_ids||[]).includes(rs.factor_id)) {
                const minLvl = lvlOrd[p.min_risk_level||'moderado']||2;
                if ((lvlOrd[rs.classification]||0) >= minLvl) suggestions.push({ rs, p });
            }
        }
    }
    if (!suggestions.length) {
        document.getElementById('interventions-list').innerHTML = '<div class="empty-state"><div class="icon">✅</div><h3>Nenhum fator de risco elevado</h3></div>';
        return;
    }
    document.getElementById('interventions-list').innerHTML = suggestions.map(({ rs, p }) => {
        const inc = existIds.has(p.id);
        return `<div class="program-card"><div class="flex-between"><h4>${p.name}</h4><span class="badge badge-${rs.classification}">${rs.classification}</span></div>
            <p style="font-size:13px;color:var(--text-light);margin:8px 0">${p.objetivo||p.description||''}</p>
            <div class="meta"><span>Modalidade: ${p.modalidade||'-'}</span><span>Duração: ${p.duracao||'-'}</span><span>Público: ${p.publico_alvo||'-'}</span></div>
            <div style="margin-top:12px"><button class="btn btn-sm ${inc?'btn-secondary':'btn-primary'}" onclick="addIntervention('${rs.id}','${p.id}',this)" ${inc?'disabled':''}>${inc?'✓ Incluído':'+ Incluir'}</button></div></div>`;
    }).join('');
}

async function addIntervention(rsId, catId, btn) {
    await sb.from('assessment_interventions').insert({
        assessment_id: currentAssessmentId, risk_score_id: rsId, catalog_id: catId, created_by: currentUser.id
    });
    btn.textContent = '✓ Incluído'; btn.classList.replace('btn-primary','btn-secondary'); btn.disabled = true;
    toast('Incluído!');
}

function goToInterventions() { navigate('intervencoes'); }
function confirmInterventions() { toast('Intervenções confirmadas!'); navigate('plano-acao'); }

// ══ T-11: Catalog ══
let catalogData = [];
async function loadCatalogo() {
    const { data } = await sb.from('intervention_catalog').select('*').order('created_at');
    catalogData = data || [];
    renderCatalog(catalogData);
}

function renderCatalog(items) {
    document.getElementById('catalog-list').innerHTML = !items.length
        ? '<div class="empty-state"><p>Catálogo vazio</p></div>'
        : items.map(p => `<div class="program-card"><div class="flex-between"><h4>${p.name}</h4>${p.is_custom?'<span class="tag">Personalizado</span>':'<span class="tag">Padrão</span>'}</div>
            <p style="font-size:13px;color:var(--text-light);margin:8px 0">${p.objetivo||p.description||''}</p>
            <div class="meta"><span>Modalidade: ${p.modalidade||'-'}</span><span>Duração: ${p.duracao||'-'}</span><span>Público: ${p.publico_alvo||'-'}</span></div></div>`).join('');
}

function filterCatalog() {
    const q = document.getElementById('catalog-search').value.toLowerCase();
    renderCatalog(catalogData.filter(p => p.name.toLowerCase().includes(q)||(p.description||'').toLowerCase().includes(q)));
}

function showCreateProgram() { document.getElementById('modal-program').classList.add('active'); }

async function saveProgram() {
    const name = document.getElementById('prog-name').value;
    if (!name) { toast('Nome obrigatório', 'error'); return; }
    await sb.from('intervention_catalog').insert({
        name, objetivo: document.getElementById('prog-objetivo').value || null,
        modalidade: document.getElementById('prog-modalidade').value || null,
        duracao: document.getElementById('prog-duracao').value || null,
        publico_alvo: document.getElementById('prog-publico').value || null,
        description: document.getElementById('prog-desc').value || null,
        is_custom: true, created_by: currentUser.id,
    });
    toast('Programa criado!'); closeModal('modal-program'); loadCatalogo();
}

// ══ T-13: Action Plan ══
async function loadPlanoAcao() {
    if (!currentAssessmentId) return;
    let { data: plans } = await sb.from('action_plans').select('*').eq('assessment_id', currentAssessmentId);
    let plan = plans?.[0];

    if (!plan) {
        const { data: newPlan } = await sb.from('action_plans').insert({ assessment_id: currentAssessmentId }).select().single();
        plan = newPlan;

        const { data: intvs } = await sb.from('assessment_interventions').select('*, intervention_catalog:catalog_id(name, description), risk_scores:risk_score_id(classification)').eq('assessment_id', currentAssessmentId);
        for (const intv of (intvs||[])) {
            const nm = intv.custom_name || intv.intervention_catalog?.name || 'Ação';
            const desc = intv.custom_description || intv.intervention_catalog?.description || '';
            await sb.from('action_items').insert({
                action_plan_id: plan.id, intervention_id: intv.id,
                description: `${nm}: ${desc}`,
                priority: intv.risk_scores?.classification || 'moderado',
                action_type: 'controle',
            });
        }
    }
    currentActionPlanId = plan.id;

    const { data: items } = await sb.from('action_items').select('*').eq('action_plan_id', plan.id).order('priority');
    const priOrd = { critico: 0, alto: 1, moderado: 2, baixo: 3 };
    (items||[]).sort((a,b) => (priOrd[a.priority]||3)-(priOrd[b.priority]||3));

    document.getElementById('plano-actions').innerHTML = !(items||[]).length
        ? '<div class="alert alert-info">Nenhuma ação. Adicione intervenções primeiro.</div>'
        : `<div class="card"><div class="card-header"><h2>Ações do Plano</h2><span class="badge badge-${plan.approval_status}">${fmtApproval(plan.approval_status)}</span></div>
        <div class="card-body table-container"><table><thead><tr><th>Prioridade</th><th>Ação</th><th>Tipo</th><th>Responsável</th><th>Prazo</th><th>Status</th></tr></thead>
        <tbody>${items.map(it => `<tr>
            <td><span class="badge badge-${it.priority}">${it.priority}</span></td>
            <td style="max-width:300px;font-size:13px">${it.description}</td>
            <td><select onchange="updItem('${it.id}','action_type',this.value)" style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px">
                <option value="eliminacao" ${it.action_type==='eliminacao'?'selected':''}>Eliminação</option>
                <option value="reducao" ${it.action_type==='reducao'?'selected':''}>Redução</option>
                <option value="controle" ${it.action_type==='controle'?'selected':''}>Controle</option>
                <option value="epi" ${it.action_type==='epi'?'selected':''}>EPI</option></select></td>
            <td><input type="text" value="${it.responsible_name||''}" onchange="updItem('${it.id}','responsible_name',this.value)" style="width:110px;padding:4px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px"></td>
            <td><input type="date" value="${it.due_date||''}" onchange="updItem('${it.id}','due_date',this.value)" style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px"></td>
            <td><span class="badge badge-${it.status}">${fmtStatus(it.status)}</span></td>
        </tr>`).join('')}</tbody></table></div></div>`;
}

function goToActionPlan() { navigate('plano-acao'); }
async function updItem(id, field, val) { await sb.from('action_items').update({ [field]: val }).eq('id', id); }

// ══ T-14: Presentation ══
async function loadApresentacao() {
    if (!currentAssessmentId) return;
    const [{ data: a }, { data: risks }] = await Promise.all([
        sb.from('assessments').select('*, sectors(name), companies:company_id(name)').eq('id', currentAssessmentId).single(),
        sb.from('risk_scores').select('*, factors(name, code)').eq('assessment_id', currentAssessmentId).order('final_score', { ascending: false }),
    ]);
    document.getElementById('presentation-preview').innerHTML = `
        <div style="text-align:left;max-width:600px;margin:20px auto">
            <div class="card" style="background:linear-gradient(135deg,var(--primary-dark),var(--primary));color:white;padding:32px;text-align:center;margin-bottom:16px">
                <h2 style="font-size:20px">Diagnóstico de Riscos Psicossociais</h2>
                <p style="opacity:0.8">${a.companies?.name||''} — ${a.sectors?.name||''}</p>
                <p style="opacity:0.6;font-size:12px">NR-1 · Portaria MTE nº 1.419/2024</p></div>
            <div class="card"><div class="card-header"><h2>Resultado Geral</h2></div><div class="card-body">
                <div class="risk-indicator ${a.nivel_risco_geral}"><div class="risk-score">${Math.round(a.indice_risco_geral||0)}</div><div><div class="risk-label">${a.nivel_risco_geral||'-'}</div></div></div></div></div>
            <div class="card"><div class="card-header"><h2>Fatores de Risco</h2></div><div class="card-body">
                ${(risks||[]).map(rs => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                    <span style="width:40px;font-weight:600">${rs.factors?.code}</span>
                    <div class="risk-bar" style="flex:1;max-width:${rs.final_score}%;background:${rs.classification==='critico'?'#880E4F':rs.classification==='alto'?'#F44336':rs.classification==='moderado'?'#FF9800':'#4CAF50'}">${Math.round(rs.final_score)}</div>
                    <span class="badge badge-${rs.classification}">${rs.classification}</span></div>`).join('')}
            </div></div></div>`;
}

// ══ T-15: Approval ══
async function loadAprovacao() {
    if (!currentActionPlanId && currentAssessmentId) {
        const { data: plans } = await sb.from('action_plans').select('*').eq('assessment_id', currentAssessmentId);
        if (plans?.[0]) currentActionPlanId = plans[0].id;
    }
    if (!currentActionPlanId) {
        document.getElementById('approval-status-display').innerHTML = '<div class="alert alert-warning">Nenhum plano de ação encontrado. Crie um plano antes de submeter para aprovação.</div>';
        return;
    }
    const { data: plan } = await sb.from('action_plans').select('*').eq('id', currentActionPlanId).single();
    if (!plan) return;

    const { count } = await sb.from('action_items').select('id', { count: 'exact', head: true }).eq('action_plan_id', plan.id);

    document.getElementById('approval-status-display').innerHTML = `
        <div class="alert alert-info" style="margin-bottom:16px">
            <strong>Plano com ${count||0} ações</strong> — Status atual: <span class="badge badge-${plan.approval_status}">${fmtApproval(plan.approval_status)}</span>
            ${plan.approved_at ? `<br><small>Última atualização: ${fmtDate(plan.approved_at)} por ${plan.approver_name||'—'} (${plan.approver_role||'—'})</small>` : ''}
        </div>`;

    if (plan.approval_status && plan.approval_status !== 'pendente') {
        const radio = document.querySelector(`input[name="approval-status"][value="${plan.approval_status}"]`);
        if (radio) radio.checked = true;
    }
    document.getElementById('approval-notes').value = plan.approval_notes || '';
    document.getElementById('approval-name').value = plan.approver_name || '';
    document.getElementById('approval-role').value = plan.approver_role || '';
}

function goToApproval() { navigate('aprovacao'); }

async function submitApproval() {
    if (!currentActionPlanId) { toast('Nenhum plano', 'error'); return; }
    const st = document.querySelector('input[name="approval-status"]:checked')?.value;
    if (!st) { toast('Selecione status', 'error'); return; }
    await sb.from('action_plans').update({
        approval_status: st, approval_notes: document.getElementById('approval-notes').value || null,
        approver_name: document.getElementById('approval-name').value || null,
        approver_role: document.getElementById('approval-role').value || null,
        approved_by: currentUser.id, approved_at: new Date().toISOString(),
    }).eq('id', currentActionPlanId);
    toast('Plano atualizado!'); navigate('acompanhamento');
}

// ══ T-16: Tracking ══
async function loadAcompanhamento() { switchTrackingView('kanban', document.querySelector('.tabs .tab')); }

async function switchTrackingView(view, tabEl) {
    document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
    if (tabEl) tabEl.classList.add('active');
    const { data: items } = await sb.from('action_items').select('*').order('priority').order('due_date');

    if (view === 'kanban') {
        const g = { pendente:[], em_andamento:[], concluida:[], atrasada:[] };
        (items||[]).forEach(i => { if(g[i.status]) g[i.status].push(i); });
        document.getElementById('tracking-content').innerHTML = `<div class="kanban-board">
            ${Object.entries(g).map(([s, cards]) => `<div class="kanban-column">
                <h3><span class="badge badge-${s}">${fmtStatus(s)}</span> (${cards.length})</h3>
                ${cards.map(c => `<div class="kanban-card" onclick="updItemStatus('${c.id}')">
                    <div style="font-size:12px;margin-bottom:4px"><span class="badge badge-${c.priority}" style="font-size:10px">${c.priority}</span></div>
                    <div>${(c.description||'').substring(0,80)}${c.description?.length>80?'...':''}</div>
                    <div style="font-size:11px;color:var(--text-light);margin-top:8px">${c.responsible_name||'Sem responsável'} · ${c.due_date?fmtDate(c.due_date):'Sem prazo'}</div>
                </div>`).join('')||'<p style="font-size:12px;color:var(--text-light)">Vazio</p>'}
            </div>`).join('')}</div>`;
    } else {
        document.getElementById('tracking-content').innerHTML = `<div class="card"><div class="card-body table-container">
            <table><thead><tr><th>Ação</th><th>Prioridade</th><th>Responsável</th><th>Prazo</th><th>Status</th><th>%</th></tr></thead>
            <tbody>${(items||[]).map(it => `<tr>
                <td style="max-width:250px;font-size:13px">${(it.description||'').substring(0,60)}...</td>
                <td><span class="badge badge-${it.priority}">${it.priority}</span></td>
                <td>${it.responsible_name||'-'}</td><td>${it.due_date?fmtDate(it.due_date):'-'}</td>
                <td><select onchange="updItemStatusDirect('${it.id}',this.value)" style="padding:4px;border:1px solid var(--border);border-radius:4px;font-size:12px">
                    <option value="pendente" ${it.status==='pendente'?'selected':''}>Pendente</option>
                    <option value="em_andamento" ${it.status==='em_andamento'?'selected':''}>Em andamento</option>
                    <option value="concluida" ${it.status==='concluida'?'selected':''}>Concluída</option>
                    <option value="atrasada" ${it.status==='atrasada'?'selected':''}>Atrasada</option></select></td>
                <td><div class="progress-bar" style="width:80px"><div class="fill green" style="width:${it.completion_pct||0}%"></div></div> ${it.completion_pct||0}%</td>
            </tr>`).join('')}</tbody></table></div></div>`;
    }
}

async function updItemStatus(id) {
    const s = prompt('Novo status (pendente, em_andamento, concluida, atrasada):');
    if (s && ['pendente','em_andamento','concluida','atrasada'].includes(s)) {
        await sb.from('action_items').update({ status: s }).eq('id', id);
        toast('Atualizado'); loadAcompanhamento();
    }
}
async function updItemStatusDirect(id, s) {
    await sb.from('action_items').update({ status: s }).eq('id', id);
    toast('Status atualizado');
}

// ══ T-18: Re-evaluation ══
async function loadReavaliacao() {
    const { data: companies } = await sb.from('companies').select('id, name').order('name');
    let html = `<div class="card"><div class="card-body">
        <div class="form-row">
            <div class="form-group"><label>Empresa</label>
                <select id="reav-empresa" onchange="loadReavSectors()"><option value="">Selecione...</option>
                ${(companies||[]).map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
            <div class="form-group"><label>Setor</label><select id="reav-setor" onchange="loadReavComparativo()"><option value="">Selecione...</option></select></div>
        </div></div></div>
        <div id="reav-resultado"></div>`;
    document.getElementById('reavaliacao-content').innerHTML = html;
}

async function loadReavSectors() {
    const cid = document.getElementById('reav-empresa').value;
    if (!cid) return;
    const { data } = await sb.from('sectors').select('id, name').eq('company_id', cid);
    document.getElementById('reav-setor').innerHTML = '<option value="">Selecione...</option>' + (data||[]).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    document.getElementById('reav-resultado').innerHTML = '';
}

async function loadReavComparativo() {
    const cid = document.getElementById('reav-empresa').value;
    const sid = document.getElementById('reav-setor').value;
    if (!cid || !sid) return;

    const { data: assessments } = await sb.from('assessments')
        .select('id, cycle_number, completed_at, indice_risco_geral, nivel_risco_geral')
        .eq('company_id', cid).eq('sector_id', sid).eq('status', 'completed')
        .order('cycle_number');

    if (!assessments?.length) {
        document.getElementById('reav-resultado').innerHTML = '<div class="card"><div class="card-body"><div class="empty-state"><div class="icon">📋</div><h3>Nenhuma avaliação concluída para este setor</h3><p>Inicie uma avaliação para gerar resultados comparáveis.</p><button class="btn btn-primary" onclick="navigate(\'avaliacao-inicio\')">+ Nova Avaliação</button></div></div></div>';
        return;
    }

    if (assessments.length < 2) {
        document.getElementById('reav-resultado').innerHTML = `<div class="card"><div class="card-body">
            <div class="alert alert-info">Apenas 1 ciclo concluído (Score: ${Math.round(assessments[0].indice_risco_geral||0)} — ${assessments[0].nivel_risco_geral}). É necessário ao menos 2 ciclos para comparar.</div>
            <button class="btn btn-primary" onclick="navigate('avaliacao-inicio')">Iniciar Novo Ciclo</button></div></div>`;
        return;
    }

    const allScores = [];
    for (const a of assessments) {
        const { data: risks } = await sb.from('risk_scores').select('*, factors(name, code)').eq('assessment_id', a.id).order('factor_id');
        allScores.push({ assessment: a, risks: risks || [] });
    }

    const factorCodes = [...new Set(allScores.flatMap(s => s.risks.map(r => r.factors?.code)))].sort();

    let tableHtml = `<table><thead><tr><th>Fator</th>${assessments.map(a => `<th>Ciclo ${a.cycle_number}<br><small>${fmtDate(a.completed_at)}</small></th>`).join('')}<th>Tendência</th></tr></thead><tbody>`;

    for (const code of factorCodes) {
        tableHtml += `<tr><td><strong>${code}</strong></td>`;
        let prev = null, trend = '';
        for (const s of allScores) {
            const r = s.risks.find(r => r.factors?.code === code);
            const sc = r ? Math.round(r.final_score) : '-';
            const cls = r?.classification || '';
            tableHtml += `<td><span class="badge badge-${cls}">${sc}</span></td>`;
            if (r && prev !== null) {
                const diff = Math.round(r.final_score) - prev;
                trend = diff > 0 ? `<span style="color:var(--risk-alto)">▲ +${diff}</span>` : diff < 0 ? `<span style="color:var(--primary)">▼ ${diff}</span>` : '<span style="color:var(--text-light)">—</span>';
            }
            if (r) prev = Math.round(r.final_score);
        }
        tableHtml += `<td>${trend}</td></tr>`;
    }

    const last = assessments[assessments.length - 1];
    const penult = assessments[assessments.length - 2];
    const diff = Math.round((last.indice_risco_geral||0) - (penult.indice_risco_geral||0));
    const trendIcon = diff > 0 ? '▲' : diff < 0 ? '▼' : '—';
    const trendColor = diff > 0 ? 'var(--risk-alto)' : diff < 0 ? 'var(--primary)' : 'var(--text-light)';

    tableHtml += `<tr style="font-weight:600;background:#F5F7FA"><td>GERAL</td>${assessments.map(a => `<td><span class="badge badge-${a.nivel_risco_geral}">${Math.round(a.indice_risco_geral||0)}</span></td>`).join('')}<td><span style="color:${trendColor}">${trendIcon} ${diff > 0 ? '+' : ''}${diff}</span></td></tr>`;
    tableHtml += '</tbody></table>';

    document.getElementById('reav-resultado').innerHTML = `
        <div class="card" style="margin-top:16px"><div class="card-header"><h2>Comparativo de Ciclos</h2>
            <span style="font-size:13px;color:${trendColor}">${trendIcon} ${diff > 0 ? 'Risco aumentou' : diff < 0 ? 'Risco reduziu' : 'Sem alteração'} (${diff > 0 ? '+' : ''}${diff} pontos)</span></div>
            <div class="card-body table-container">${tableHtml}</div></div>
        <div class="btn-group" style="margin-top:16px">
            <button class="btn btn-primary" onclick="navigate('avaliacao-inicio')">Iniciar Novo Ciclo</button>
            <button class="btn btn-secondary" onclick="navigate('relatorios')">Gerar Relatório</button>
        </div>`;
}

// ══ T-19: Reports ══
async function loadRelatorios() {
    const { data } = await sb.from('companies').select('id, name').order('name');
    document.getElementById('report-empresa').innerHTML = '<option value="">Selecione...</option>'+(data||[]).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

async function loadReportAssessments() {
    const cid = document.getElementById('report-empresa').value;
    if (!cid) return;
    const { data } = await sb.from('assessments').select('id, cycle_number, completed_at, sectors(name)').eq('company_id', cid).eq('status', 'completed').order('completed_at', { ascending: false });
    document.getElementById('report-assessment').innerHTML = '<option value="">Selecione...</option>'+(data||[]).map(a => `<option value="${a.id}">${a.sectors?.name||''} — Ciclo ${a.cycle_number} (${fmtDate(a.completed_at)})</option>`).join('');
}

async function generateReport() {
    const aid = document.getElementById('report-assessment').value;
    if (!aid) { toast('Selecione avaliação', 'error'); return; }
    const [{ data: a }, { data: risks }, { data: obs }] = await Promise.all([
        sb.from('assessments').select('*, sectors(name, num_trabalhadores), companies:company_id(name, cnpj)').eq('id', aid).single(),
        sb.from('risk_scores').select('*, factors(name, code, dimension, consequence)').eq('assessment_id', aid).order('final_score', { ascending: false }),
        sb.from('factor_observations').select('*, factors(name, code)').eq('assessment_id', aid),
    ]);
    const el = document.getElementById('report-output');
    el.classList.remove('hidden');
    el.innerHTML = `<div class="card" style="margin-top:20px"><div class="card-header"><h2>Relatório de Diagnóstico</h2></div>
        <div class="card-body" id="report-print-area">
            <div style="text-align:center;margin-bottom:24px">
                <h2 style="color:var(--primary-dark)">Diagnóstico de Riscos Psicossociais — NR-1</h2>
                <p style="font-size:16px">${a.companies?.name||''}</p>
                <p style="color:var(--text-light)">Setor: ${a.sectors?.name||''} · Ciclo ${a.cycle_number} · ${fmtDate(a.completed_at)}</p>
                <p style="color:var(--text-light)">CNPJ: ${a.companies?.cnpj||'-'}</p></div>
            <div class="risk-indicator ${a.nivel_risco_geral}" style="justify-content:center">
                <div class="risk-score">${Math.round(a.indice_risco_geral||0)}</div>
                <div><div class="risk-label">Risco ${a.nivel_risco_geral}</div></div></div>
            <h3 style="margin:20px 0 12px">Resultado por Fator</h3>
            <table><thead><tr><th>Fator</th><th>Nome</th><th>Score</th><th>Nível</th><th>Consequência</th></tr></thead>
            <tbody>${(risks||[]).map(rs => `<tr><td><strong>${rs.factors?.code}</strong></td><td>${rs.factors?.name||''}</td>
                <td>${Math.round(rs.final_score)}</td><td><span class="badge badge-${rs.classification}">${rs.classification}</span></td>
                <td style="font-size:12px">${rs.factors?.consequence||''}</td></tr>`).join('')}</tbody></table>
            ${(obs||[]).length?`<h3 style="margin:20px 0 12px">Observações Clínicas</h3>${obs.map(o => `<div style="margin-bottom:8px"><strong>${o.factors?.code}:</strong> ${o.observation}</div>`).join('')}`:''}
            <div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--border);font-size:12px;color:var(--text-light)">
                <p>NR-1 cap. 1.5 — Portaria MTE nº 1.419/2024 · Guia MTE 2025</p>
                <p>Ciclo de reavaliação: 6–12 meses (NR-1 subitem 1.5.4.4.6)</p></div>
        </div></div>
        <button class="btn btn-primary mt-16" onclick="window.print()">Imprimir / Exportar PDF</button>`;
}

// ══ Avaliacoes List ══
async function loadAvaliacoes() {
    const { data } = await sb.from('assessments').select('*, sectors(name), companies:company_id(name)').order('created_at', { ascending: false });
    document.getElementById('avaliacoes-list').innerHTML = !(data||[]).length
        ? '<div class="empty-state"><div class="icon">📋</div><h3>Nenhuma avaliação</h3></div>'
        : `<table><thead><tr><th>Empresa</th><th>Setor</th><th>Ciclo</th><th>Modo</th><th>Status</th><th>Risco</th><th>Data</th><th></th></tr></thead>
        <tbody>${data.map(a => `<tr><td>${a.companies?.name||'-'}</td><td>${a.sectors?.name||'-'}</td><td>${a.cycle_number}º</td>
            <td>${a.mode==='anonimo'?'Anônimo':'Institucional'}</td>
            <td><span class="badge badge-${a.status}">${fmtStatus(a.status)}</span></td>
            <td>${a.indice_risco_geral!=null?`<span class="badge badge-${a.nivel_risco_geral}">${Math.round(a.indice_risco_geral)}</span>`:'-'}</td>
            <td>${fmtDate(a.created_at)}</td>
            <td><button class="btn btn-sm btn-secondary" onclick="currentCompanyId='${a.company_id}';openAssessment('${a.id}','${a.status}')">Abrir</button></td>
        </tr>`).join('')}</tbody></table>`;
}

async function saveConfig() {
    const name = document.getElementById('config-name').value;
    const crp = document.getElementById('config-crp').value;
    try {
        const { error } = await sb.from('profiles').upsert({
            id: currentUser.id, full_name: name || null, crp: crp || null
        });
        if (error) throw error;
        toast('Configurações salvas!');
    } catch (e) { toast(e.message, 'error'); }
}

async function loadConfiguracoes() {
    const { data } = await sb.from('profiles').select('full_name, crp').eq('id', currentUser.id).single();
    if (data) {
        document.getElementById('config-name').value = data.full_name || '';
        document.getElementById('config-crp').value = data.crp || '';
    }
}

// ══ Helpers ══
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('pt-BR') : '-'; }
function fmtStatus(s) { return { draft:'Rascunho', in_progress:'Em andamento', review:'Revisão', completed:'Concluída', coletando:'Coletando', arquivada:'Arquivada', pendente:'Pendente', em_andamento:'Em andamento', concluida:'Concluída', atrasada:'Atrasada' }[s] || s; }
function fmtApproval(s) { return { pendente:'Pendente', aprovado:'Aprovado', com_ressalvas:'Com Ressalvas', em_revisao:'Em Revisão' }[s] || s; }

// ══ Init ══
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) { currentUser = session.user; enterApp(); }
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    }
    if (e.key === 'Enter') {
        const ls = document.getElementById('screen-login');
        if (ls.classList.contains('active') || ls.style.display !== 'none') {
            if (!document.getElementById('login-form').classList.contains('hidden')) doLogin();
            else doSignup();
        }
    }
});
