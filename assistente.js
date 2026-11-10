/* ==========================================
   ACOLHE+ 💛
   Assistente virtual de prevenção ao suicídio
   Integração com Supabase e aprendizado
========================================== */

// 1. CONEXÃO COM SUPABASE

const SUPABASE_URL = "https://ysblefnczwupjjkthgqc.supabase.co";
const SUPABASE_KEY = "sb_publishable_QOuhlxo-Qis9S5OxkBh-2Q_t5xjeHEY";

let banco = null;
let conhecimentos = [];

if (window.supabase && window.supabase.createClient) {
    banco = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase conectado!");
} else {
    console.error("Biblioteca do Supabase não carregada.");
}

// 2. ELEMENTOS HTML

const abrir = document.getElementById("abrir-assistente");
const fechar = document.getElementById("fechar-assistente");
const painel = document.getElementById("painel-assistente");
const mensagens = document.getElementById("mensagens-assistente");
const formulario = document.getElementById("form-assistente");
const entrada = document.getElementById("entrada-assistente");

// 3. ABRIR E FECHAR

if (abrir && painel && entrada) {
    abrir.addEventListener("click", () => {
        painel.hidden = false;
        abrir.setAttribute("aria-expanded", "true");
        entrada.focus();
    });
}

if (fechar && painel && abrir) {
    fechar.addEventListener("click", () => {
        painel.hidden = true;
        abrir.setAttribute("aria-expanded", "false");
        abrir.focus();
    });
}

// 4. ADICIONAR MENSAGENS

function adicionarMensagem(texto, tipo) {
    if (!mensagens) return null;

    const mensagem = document.createElement("div");
    mensagem.classList.add("mensagem", ...tipo.split(" "));
    mensagem.textContent = texto;

    mensagens.appendChild(mensagem);
    mensagens.scrollTop = mensagens.scrollHeight;

    return mensagem;
}

// 5. NORMALIZAR TEXTO

function normalizar(texto) {
    return String(texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function contem(texto, palavras) {
    return palavras.some(palavra =>
        texto.includes(normalizar(palavra))
    );
}

// 6. SALVAR CONVERSAS

let conversaAtualId = null;

async function obterOuCriarConversa() {
    if (!banco) return null;
    if (conversaAtualId) return conversaAtualId;

    try {
        const novoId = crypto.randomUUID();

        const { error } = await banco
            .from("conversas")
            .insert({ id: novoId });

        if (error) {
            console.error("Erro ao criar conversa:", error);
            return null;
        }

        conversaAtualId = novoId;
        return conversaAtualId;

    } catch (erro) {
        console.error("Falha ao criar conversa:", erro);
        return null;
    }
}

async function salvarMensagem(remetente, texto) {
    if (!banco) return;

    const conversaId = await obterOuCriarConversa();
    if (!conversaId) return;

    const { error } = await banco
        .from("mensagens")
        .insert({
            conversa_id: conversaId,
            remetente: remetente,
            mensagem: texto
        });

    if (error) {
        console.error("Erro ao salvar mensagem:", error);
    }
}

// 7. CARREGAR CONHECIMENTOS

async function carregarConhecimentos() {
    if (!banco) return;

    const { data, error } = await banco
        .from("conhecimentos")
        .select("categoria, pergunta, resposta")
        .limit(100);

    if (error) {
        console.error("Erro ao carregar conhecimentos:", error);
        return;
    }

    conhecimentos = data || [];
    console.log("Conhecimentos carregados:", conhecimentos.length);
}

const carregamentoInicial = carregarConhecimentos();

// 8. BUSCAR CONHECIMENTOS

async function buscarConhecimento(perguntaUsuario) {
    await carregamentoInicial;

    if (!banco || conhecimentos.length === 0) return null;

    const pergunta = normalizar(perguntaUsuario);

    const ignorar = [
        "como", "qual", "quais", "onde", "quando",
        "porque", "para", "sobre", "isso", "essa",
        "esse", "uma", "que", "com", "dos", "das",
        "estou", "quero", "voce", "o", "a", "os",
        "as", "e", "de", "do", "da"
    ];

    const palavras = pergunta.split(" ")
        .filter(p => p.length >= 3 && !ignorar.includes(p));

    if (!palavras.length) return null;

    let melhorResultado = null;
    let maiorPontuacao = 0;

    conhecimentos.forEach(item => {
        const perguntaBanco = normalizar(item.pergunta);
        const categoriaBanco = normalizar(item.categoria);

        let pontuacao = 0;

        palavras.forEach(palavra => {
            if (perguntaBanco.includes(palavra)) {
                pontuacao += 2;
            } else if (categoriaBanco.includes(palavra)) {
                pontuacao += 1;
            }
        });

        if (pontuacao > maiorPontuacao) {
            maiorPontuacao = pontuacao;
            melhorResultado = item.resposta;
        }
    });

    return maiorPontuacao > 0 ? melhorResultado : null;
}

// 9. APRENDIZADO AUTOMÁTICO

function ehPerguntaEducativa(pergunta) {
    const texto = normalizar(pergunta);

    const formatosEducativos = [
        /^o que e /,
        /^como funciona /,
        /^qual a diferenca /,
        /^quais sao /,
        /^por que /,
        /^porque /,
        /^para que serve /,
        /^explique /,
        /^defina /
    ];

    const termosSensíveis = [
        "eu", "meu", "minha", "comigo", "estou",
        "sinto", "tenho", "quero", "preciso", "penso",
        "me matar", "suicidio", "morrer", "morte",
        "me machucar", "machucar", "nao aguento",
        "nao quero viver", "acabar com tudo",
        "ansiedade", "depressao", "triste",
        "sofrimento", "sofrendo", "medo",
        "panico", "abuso", "violencia", "solidao"
    ];

    const formatoEducativo = formatosEducativos.some(formato =>
        formato.test(texto)
    );

    const conteudoSensivel = contem(texto, termosSensíveis);

    return formatoEducativo &&
        !conteudoSensivel &&
        texto.length >= 10 &&
        texto.length <= 250;
}

async function registrarPerguntaParaAprendizado(pergunta) {
    if (!banco || !ehPerguntaEducativa(pergunta)) return;

    try {
        const { error } = await banco
            .from("perguntas_aprendizado")
            .insert({
                pergunta: pergunta.trim(),
                status: "pendente"
            });

        if (error) {
            console.error("Erro no aprendizado:", error);
        } else {
            console.log("Pergunta registrada para aprendizado!");
        }

    } catch (erro) {
        console.error("Falha no aprendizado:", erro);
    }
}

// 10. RESPOSTAS PROGRAMADAS

function responder(pergunta) {
    const texto = normalizar(pergunta);

    if (contem(texto, [
        "quero me matar", "vou me matar", "quero morrer",
        "nao quero mais viver", "tirar minha vida",
        "acabar com minha vida", "pensando em suicidio",
        "estou pensando em morrer", "quero acabar com tudo",
        "vou tirar minha vida", "quero me machucar",
        "nao aguento mais viver", "nao vejo motivo para viver"
    ])) {
        return `💛 Obrigado por compartilhar o que está sentindo.

Sinto muito que você esteja passando por um momento tão difícil. Você merece ser ouvido(a), acolhido(a) e receber ajuda.

Por favor, procure agora uma pessoa de confiança. Não fique sozinho(a) se estiver em perigo.

🚑 Em uma emergência, ligue 192 (SAMU) ou procure uma UPA ou pronto-socorro.

💛 CVV – 188: apoio emocional gratuito, disponível 24 horas.

Eu sou um assistente educativo e não substituo atendimento profissional ou de emergência. Sua vida importa!`;
    }

    if (contem(texto, [
        "oi", "ola", "bom dia", "boa tarde",
        "boa noite", "tudo bem", "quem e voce", "seu nome"
    ])) {
        return `Olá! 💛 Seja bem-vindo(a) ao Acolhe+!

Sou o assistente virtual do projeto Prevenção ao Suicídio do 2 TDS do Colégio Dirce.
Estou aqui para compartilhar informações sobre o nosso projeto e também para conversar contigo!`;
    }

    if (contem(texto, [
        "o que e suicidio", "significado de suicidio",
        "definicao de suicidio", "sobre suicidio"
    ])) {
        return `O suicídio é um fenômeno complexo e multifatorial, relacionado a diferentes fatores emocionais, sociais, psicológicos e também a situações de sofrimento.

Não existe uma única causa.

Por isso, é importante falar sobre saúde mental, combater o preconceito e facilitar o acesso ao acolhimento e ao atendimento profissional.

A prevenção é uma responsabilidade de toda a sociedade. 💛`;
    }

    if (contem(texto, [
        "saude mental", "cuidar da mente", "bem estar emocional",
        "ansiedade", "tristeza", "estresse", "emocional"
    ])) {
        return `Cuidar da saúde mental é tão importante quanto cuidar da saúde física! 💛

Algumas atitudes podem ajudar:

• Conversar com pessoas de confiança.
• Respeitar seus próprios limites.
• Ter momentos de descanso e lazer.
• Manter vínculos com pessoas importantes.
• Procurar ajuda profissional quando necessário.

Não é necessário enfrentar momentos difíceis sozinho(a).`;
    }

    if (contem(texto, [
        "ajudar alguem", "ajudar um amigo", "meu amigo",
        "minha amiga", "pessoa triste", "alguem sofrendo",
        "como ajudar", "amigo quer morrer"
    ])) {
        return `Acolher alguém que está sofrendo pode fazer muita diferença!

Você pode:

• Escutar com atenção e sem julgamentos.
• Demonstrar preocupação e carinho.
• Levar a sério falas sobre morte ou sofrimento.
• Perguntar diretamente se a pessoa está pensando em suicídio, sem julgá-la.
• Incentivar a busca por ajuda profissional.
• Procurar um adulto de confiança, especialmente quando envolver estudantes menores de idade.

Se houver risco imediato, não deixe a pessoa sozinha e procure atendimento de emergência.

Lembre-se: você pode apoiar alguém, mas não precisa resolver tudo sozinho(a).`;
    }

    if (contem(texto, [
        "sinais de alerta", "sinais de suicidio",
        "como identificar", "como perceber",
        "sinais de sofrimento", "mudancas de comportamento"
    ])) {
        return `Algumas mudanças podem indicar que alguém precisa de acolhimento:

• Isolamento social.
• Falas sobre morte ou falta de esperança.
• Sofrimento emocional intenso.
• Sentimentos de culpa ou inutilidade.
• Mudanças importantes no comportamento.
• Despedidas ou falas preocupantes.

Esses sinais não confirmam um diagnóstico, mas merecem atenção.

O mais importante é ouvir, acolher e incentivar a procura por ajuda.`;
    }

    if (contem(texto, [
        "prevencao", "prevenir", "como evitar",
        "combater o suicidio", "como combater", "valorizar a vida"
    ])) {
        return `A prevenção ao suicídio envolve informação, acolhimento e acesso à ajuda!

Algumas atitudes importantes:

• Conversar sobre saúde mental.
• Combater o preconceito.
• Incentivar a busca por atendimento profissional.
• Construir ambientes escolares acolhedores.
• Não ignorar sinais de sofrimento.
• Fortalecer os vínculos de amizade e familiares.

Todos podemos contribuir para uma sociedade mais acolhedora! 💛`;
    }

    if (contem(texto, [
         "telefone de ajuda",
        "numero do cvv", "cvv", "caps", "ubs",
        "psicologo", "psicologa", "atendimento"
    ])) {
        return `Você não precisa enfrentar momentos difíceis sozinho(a). Existem serviços preparados para ajudar! 💛

📞 CVV – 188
Apoio emocional gratuito, disponível 24 horas.

🏥 UBS
Unidade Básica de Saúde da sua região.

💛 CAPS
Serviços públicos especializados em saúde mental.

🚑 SAMU – 192
Para emergências médicas.

Você também pode procurar um professor, familiar ou adulto de confiança.

Se houver perigo imediato, procure uma UPA ou pronto-socorro.`;
    }

    if (contem(texto, [
        "setembro amarelo", "campanha amarela", "mes de prevencao"
    ])) {
        return `O Setembro Amarelo é uma campanha de conscientização sobre a prevenção ao suicídio.

Seu objetivo é incentivar o diálogo, promover a valorização da vida e combater o preconceito relacionado à saúde mental.

Falar sobre o assunto com responsabilidade é uma forma de contribuir para a prevenção! 💛`;
    }

    if (contem(texto, [
        "escola", "professor", "aluno",
        "estudante", "ambiente escolar"
    ])) {
        return `A escola possui um papel muito importante na promoção da saúde mental!

Ela pode:

• Promover campanhas educativas.
• Incentivar conversas sobre emoções.
• Combater o bullying e a discriminação.
• Oferecer espaços de escuta e acolhimento.
• Orientar estudantes sobre onde buscar ajuda.

Uma escola acolhedora pode contribuir para que ninguém se sinta sozinho(a). 💛`;
    }

    if (contem(texto, [
        "bullying", "cyberbullying", "perseguicao", "humilhacao"
    ])) {
        return `O bullying pode causar sofrimento emocional e prejudicar a saúde mental.

É importante:

• Não participar de humilhações.
• Não compartilhar conteúdos ofensivos.
• Apoiar quem sofre agressões.
• Comunicar a situação a um professor ou responsável.
• Buscar ajuda quando necessário.

Respeito e empatia ajudam a construir uma escola mais segura. 💛`;
    }

    if (contem(texto, ["obrigado", "obrigada", "valeu"])) {
        return `Por nada! 💛

Obrigado por conversar comigo.

Lembre-se: ouvir, acolher e respeitar são atitudes que podem fazer a diferença na vida de alguém!`;
    }

    if (contem(texto, ["tchau", "ate mais", "adeus", "vou embora"])) {
        return `Até mais! 💛

Obrigado por conhecer nosso projeto.

Lembre-se de que pedir ajuda não é sinal de fraqueza. Você merece cuidado e acolhimento!`;
    }

    return null;
}

// 11. ENVIAR MENSAGENS

async function enviarMensagem(texto) {
    if (!texto || !texto.trim() || !mensagens) return;

    adicionarMensagem(texto, "usuario");
    await salvarMensagem("usuario", texto);

    let resposta = responder(texto);

    if (!resposta) {
        const carregando = adicionarMensagem(
            "Estou procurando uma resposta para você... 💛",
            "bot carregando"
        );

        try {
            resposta = await buscarConhecimento(texto);
        } catch (erro) {
            console.error("Erro ao pesquisar:", erro);
        } finally {
            if (carregando) carregando.remove();
        }
    }

    // REGISTRO AUTOMÁTICO DE PERGUNTAS SEM RESPOSTA
    if (!resposta) {
        await registrarPerguntaParaAprendizado(texto);

        resposta = `Ainda estou aprendendo a responder algumas coisas! 💛

    Me desculpe por não conseguir te ajudar nessa questão, se você se sentir confortável
    pode entrar em contato para reclamar sobre esse erro, ou se preferir ajuda humanizada,
    estamos dispostos a ajudar do mesmo jeito! 
    
        Novamente peço perdão pela minha falta de conhecimento...`;
    }

    adicionarMensagem(resposta, "bot");
    await salvarMensagem("assistente", resposta);
}

// 12. FORMULÁRIO

if (formulario && entrada) {
    formulario.addEventListener("submit", async function(evento) {
        evento.preventDefault();

        const texto = entrada.value.trim();
        if (!texto) return;

        entrada.value = "";

        await enviarMensagem(texto);

        entrada.focus();
    });
} else {
    console.error("Formulário ou campo de entrada não encontrado.");
}

// 13. PERGUNTAS PRONTAS

document.querySelectorAll(".pergunta-pronta").forEach(botao => {
    botao.addEventListener("click", function() {
        enviarMensagem(botao.textContent);
    });
});

// 14. INICIALIZAÇÃO

console.log("Acolhe+ inicializado!");

if (!mensagens) {
    console.error("Confira o id='mensagens-assistente' no HTML.");
}