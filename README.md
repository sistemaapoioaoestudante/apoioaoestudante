# Apoio ao Estudante

Plataforma local de apoio ao planejamento pedagógico inclusivo: gera atividades
adaptadas à BNCC para alunos com necessidades educacionais especiais (NEE),
com login individual, separação real de permissões entre professora e
coordenação, e cadastro completo de turmas, professoras e alunos.

O sistema roda **num computador da escola**: os dados das crianças e a IA
ficam nele, sem depender de internet. As professoras usam pelo navegador,
no próprio computador ou no celular (rede privada da escola).

## Instalação na escola (recomendado)

1. Baixe o `instalar-apoio-ao-estudante.exe` (página **Releases** do
   repositório) e abra com dois cliques. O Windows pede permissão de
   administrador.
2. Escolha **Primeira instalação na escola** (ou **Troca de computador**, para
   trazer os dados do computador antigo pela rede).
3. Informe o **e-mail e a senha da coordenação** e o **modelo de IA**.
4. O instalador baixa o que faltar (Node.js, Ollama e o modelo de IA) e
   deixa tudo pronto:
   - o sistema fica **sempre no ar**: abre sozinho quando o computador liga,
     mesmo antes de alguém entrar no Windows, e volta sozinho se fechar;
   - um **ícone perto do relógio** mostra se o sistema está no ar e, se
     alguém mandar desligar o computador, o Windows avisa que as professoras
     vão ficar sem acesso e pergunta se quer desligar mesmo assim;
   - atalhos no menu Iniciar: abrir o sistema, cópia para pendrive,
     acesso pelo celular, trocar de computador e recuperar a senha da
     coordenação.

Instalar por cima (nova versão) **mantém os dados** e as configurações.
Para montar o instalador a partir do código, veja `instalador/LEIAME.md`.

## Instalação manual (desenvolvimento)

O `iniciar.bat` (passo 3 abaixo) confere, toda vez que abre, se o Node.js e
o Ollama estão instalados e baixa o modelo de IA se faltar. Ele **não
instala o Node.js nem o Ollama**: se algum faltar, avisa com o link para
baixar.

### 1. Instalar o Node.js (só na primeira vez)

1. Acesse [nodejs.org](https://nodejs.org) e baixe o instalador **LTS para
   Windows (.msi)** — é o botão em destaque na página inicial.
2. Abra o arquivo baixado e siga o assistente clicando em **Next** em todas
   as telas, mantendo as opções padrão. Confirme a permissão de
   administrador quando o Windows pedir.
3. Para confirmar que funcionou, abra um terminal (Prompt de Comando ou
   PowerShell) e rode:

   ```bash
   node --version
   ```

   Se aparecer um número de versão **22.13 ou mais novo** (ex.: `v24.21.0`),
   está tudo certo. Versões mais antigas não têm o banco SQLite embutido.
   **Não é necessário rodar `npm install`** — veja "Por que sem
   dependências?" abaixo.

### 2. Instalar o Ollama (só na primeira vez)

O Ollama é a IA local e gratuita que gera as atividades. Sem ele, o resto do
sistema funciona (cadastros, alunos, histórico), mas a geração de atividades
fica indisponível. Para instalar:

1. Acesse [ollama.com/download](https://ollama.com/download) e baixe o
   instalador para **Windows**.
2. Abra o arquivo baixado e siga o assistente clicando em **Next/Install**
   em todas as telas, mantendo as opções padrão.
3. Para confirmar que funcionou, abra um terminal (Prompt de Comando ou
   PowerShell) e rode:

   ```bash
   ollama --version
   ```

   Se aparecer um número de versão, está tudo certo. O Ollama já fica
   aberto sozinho em segundo plano depois de instalado (ícone na bandeja do
   Windows, perto do relógio).
4. Baixe um modelo de IA (necessário — o Ollama sozinho não gera nada sem
   um modelo baixado). Isso é opcional fazer manualmente agora: se pular
   este passo, o `iniciar.bat` detecta que o modelo está faltando e baixa
   ele sozinho automaticamente na próxima vez que o sistema for aberto. Se
   preferir baixar antes, rode em um terminal:

   ```bash
   ollama pull qwen2.5:7b
   ```

   Isso baixa uns 4,7 GB na primeira vez e precisa de 8–16 GB de RAM livre
   na máquina. O Qwen2.5 7B é o modelo recomendado hoje: segue melhor o
   formato JSON pedido pelo sistema e lida bem com português. Se a máquina
   for mais fraca, dá para usar um modelo menor como `llama3.2` (uns 2 GB,
   mas erra mais o formato pedido — nesse caso o sistema já tenta gerar as
   atividades uma de cada vez antes de desistir, e nunca trava a tela).
   Outros modelos em [ollama.com/library](https://ollama.com/library)
   também funcionam — em geral, modelos maiores seguem melhor o formato
   pedido, mas usam mais memória/CPU.

Depois de instalado o Ollama e baixado o modelo, é só rodar o sistema (passo
3 abaixo) e ativar a IA pela tela **Coordenação → IA** — veja o passo a
passo completo em "Sobre a geração por IA" mais abaixo.

### 3. Rodar o projeto

**Jeito fácil:** dê dois cliques em `iniciar.bat`, na raiz desta pasta. Ele
confere se o Node.js e o Ollama estão instalados (avisando com um link se
algum estiver faltando) e baixa o modelo de IA recomendado automaticamente
se ainda não tiver sido baixado — na primeira vez que isso acontecer, essa
janela vai ficar mostrando o progresso do download por alguns minutos antes
de abrir o sistema. Depois disso abre uma janela de terminal com o servidor
rodando, e o navegador abre sozinho em `http://127.0.0.1:3000` depois de
alguns segundos. Deixe essa janela aberta enquanto estiver usando o sistema.

**Manual**, se preferir (ou se o duplo clique não funcionar):

```bash
cd apoio-estudante-app
node server/index.js
```

Na primeira execução o banco de dados local é criado automaticamente
(`data/apoio.sqlite`) com **dados de demonstração fictícios** (5 turmas,
7 professoras, 18 alunos), e o terminal mostra as contas de acesso. Todas usam
a senha `123456`, por exemplo:

- **Professora** — `professora@escola.com` (Ana Paula), `carla@escola.com`...
- **Coordenação** — `coordenacao@escola.com`

Para uso real, comece **sem** esses dados — veja "Começar a usar de verdade"
abaixo.

Depois abra `http://127.0.0.1:3000` no navegador (o `iniciar.bat` já faz
isso sozinho). **No primeiro login o sistema obriga cada pessoa a criar uma
senha própria** (mínimo 8 caracteres) — até isso acontecer, nada mais abre.
Depois, qualquer pessoa troca a própria senha pelo botão **Trocar senha** no
topo da tela.

Senhas criadas ou redefinidas pela coordenação (menu **Professoras**)
são sempre **provisórias**: a professora cria a dela no próximo login.

### Segurança e backup

- Cópia automática diária do banco em `data/backups/apoio-AAAA-MM-DD.sqlite`
  (últimos 30 dias), feita com o sistema rodando e sem risco de cópia pela
  metade. **Para voltar a um dia anterior:** feche o sistema, apague
  `data/apoio.sqlite` (e `apoio.sqlite-wal` / `apoio.sqlite-shm`, se
  existirem) e copie o backup desejado para `data/apoio.sqlite`. Esses
  backups ficam no mesmo computador — **uma vez
  por semana, dê dois cliques em `backup-pendrive.bat`** com o pendrive
  conectado: ele copia o banco e os backups para
  `<pendrive>:\ApoioEstudante-backup\<data>`. O pendrive passa a ter dados
  pessoais das crianças: guarde-o trancado.
- Login bloqueado temporariamente após várias tentativas erradas (por conta e
  por aparelho).
- Login cai após **2 horas sem uso** (e no máximo 12 horas), importante em
  computador ou celular compartilhado.
- **Esqueceu a senha da coordenação?**
  1. Outra conta da coordenação redefine (tela Professoras → "Contas da
     coordenação"). Tenha sempre pelo menos duas.
  2. Sem outra conta: dois cliques em `recuperar-acesso.bat`. Ele pede a
     senha de **administrador do Windows** e cria uma senha provisória.
     Por isso o computador da escola precisa ter senha no Windows.
- **Trocar de computador:** `migrar.bat` no computador novo traz todos os dados
  do antigo pela rede privada. Exige o login da coordenação. Passo a passo em
  [docs/acesso-remoto.md](docs/acesso-remoto.md).
- **Acesso por celular/tablet:** veja [docs/acesso-remoto.md](docs/acesso-remoto.md).
  O recomendado é a rede privada Tailscale. O sistema se recusa a abrir para a
  rede sem HTTPS.
- O código de segurança fica separado em módulos: `server/access/` (quem vê
  qual aluno e ano letivo), `server/security/` (tentativas de login e acesso
  pela rede), `server/middleware/` (troca obrigatória de senha, bloqueio de
  requisições de outros sites) e `server/util/securityHeaders.js` (cabeçalhos
  de proteção do navegador).

Para encerrar o servidor, feche a janela do terminal ou pressione `Ctrl+C`.
Para usar de novo depois, é só repetir o passo 2 (dois cliques no
`iniciar.bat`, ou o comando manual).

Comandos úteis:

```bash
npm start        # mesma coisa que "node server/index.js"
npm run seed     # cria o banco se ele ainda não existir
npm run reset-db # apaga tudo e recria os dados de demonstração
npm run testar   # testes automáticos (usam uma pasta temporária, nunca o banco real)
npm run medir    # ensaios de carga e de banco (dados fictícios; resultados em bench/resultados)
node bench/latenciaIa.js llama3.2   # tempo de geração pela IA neste computador
```

#### Começar a usar de verdade (sem os dados de demonstração)

Com o sistema **fechado**, rode:

```bash
npm run iniciar-escola -- --force
```

Antes de apagar, uma cópia do banco atual é salva em
`data/backups/antes-do-reset-<data>.sqlite`. O banco novo fica só com a BNCC, a
base de deficiências e uma conta da coordenação, com senha provisória
mostrada **uma única vez** na tela (anote). Para usar outro e-mail na conta
da coordenação, defina `COORD_EMAIL` antes do comando. Depois, cadastre turmas,
professoras e alunos em **Coordenação**.

## Recursos principais

- **Login de verdade**: senhas com hash (scrypt), sessão por cookie
  `HttpOnly`, uma conta por profissional.
- **Controle de acesso aplicado pelo servidor, não pela tela**: os dados
  pessoais do aluno (nascimento, responsável, telefone, documentos)
  **nunca são enviados** para quem está logado como professora; só a
  coordenação recebe esses dados do servidor.
- **Cadastro completo (CRUD)**: a coordenação cria, edita e remove turmas,
  professoras (com login próprio) e alunos pela própria interface.
- **Banco de dados SQLite**: os dados ficam em `data/apoio.sqlite`, com
  regras de integridade e gravações "tudo ou nada" (ver "Banco de dados"
  abaixo).
- **Base da BNCC completa**: todos os objetivos de aprendizagem do Pré I e
  do Jardim.
- **Visual e responsividade**: menu lateral retrátil no celular, janelas
  com rolagem em telas pequenas e formulários adaptados para o celular.
- **Atividades que aprendem com o feedback**: atividades marcadas como "Não
  funcionou" para um aluno são informadas à IA, que evita repeti-las.
- **Geração de atividades por IA local**: a IA gera as 3 atividades do
  Atendimento Rápido sob medida para o aluno, e cada uma aparece na tela
  assim que fica pronta — ver a seção abaixo.

## Sobre a geração por IA

As atividades do Atendimento Rápido e as sugestões da Base de Deficiências
("Consultar IA") são geradas pela **IA local com Ollama**: um modelo de
linguagem que roda **neste computador**, de graça e sem internet.

Como funciona a geração de atividades:

- **Uma única consulta, uma atividade de cada vez na tela.** A IA escreve as 3
  atividades em sequência e cada uma aparece assim que fica completa (só
  atividades completas e conferidas são mostradas).
- **Formato garantido**: o sistema envia ao Ollama um esquema fixo
  (`server/ai/activityFormat.js`), que o obriga a devolver exatamente 3
  atividades com todos os campos.
- **Limite de 3 minutos**: se a IA não terminar nesse tempo, a professora vê
  quantas atividades chegaram e um botão "Gerar novamente".
- **IA desligada ou com problema**: a tela mostra uma mensagem clara e o botão
  "Gerar novamente". Não há atividades "prontas" de reserva — tudo o que
  aparece como sugestão veio da IA.
- **Modelo sempre pronto**: ao iniciar o sistema, a IA é preparada em segundo
  plano (`server/ai/warmup.js`), e fica carregada na memória por 4 horas
  após o último uso (ocupa ~5 GB de RAM).

Tempo medido num notebook sem placa de vídeo (i5 8ª geração), **ligado na
tomada**: a 1ª atividade aparece em ~1 minuto e as 3 ficam prontas em ~2min20s.
Num computador com placa de vídeo, leva segundos.

> **Importante — o computador que roda o sistema precisa ficar na tomada.**
> Na bateria, o Windows reduz a velocidade do processador e a IA fica cerca de
> **4 vezes mais lenta** (medido: nem a 1ª atividade fica pronta dentro do
> limite de 3 minutos). Se possível, deixe também o modo de energia do Windows
> em **"Melhor desempenho"** (Configurações → Sistema → Energia).

Por que só o Ollama: os dados são de crianças com deficiência (dados
sensíveis pela LGPD). Com o Ollama, **nada sai do computador da escola**.
Mesmo assim, nenhum dado pessoal do aluno (nome completo, nascimento,
responsável, telefone, documentos) é enviado à IA — só o perfil pedagógico,
pontos fortes/cuidados, tema do dia e objetivo BNCC.

### Como ativar

Se ainda não instalou o Ollama nem baixou um modelo, veja o passo 2 em "Como
instalar e rodar". Depois:

1. Deixe o Ollama aberto em segundo plano (ele já sobe sozinho com o Windows
   depois de instalado e fica em `http://127.0.0.1:11434`).
2. Entre como coordenação, vá em **Coordenação → IA**, escolha "Ollama",
   confirme o endereço e o modelo, e clique em Salvar.

Modelo recomendado: `qwen2.5:7b` (segue bem o formato pedido). Em computador
mais fraco, se ficar lento, teste um modelo menor (ex.: `qwen2.5:3b`).

Alternativa sem a tela: no arquivo `.env` (veja `.env.example`), defina
`AI_PROVIDER=ollama`. O que for salvo pela tela tem prioridade sobre o `.env`.

O código da IA fica em `server/ai/aiService.js` (o que o sistema pede à IA) e
`server/ai/` (textos dos prompts, conexão com o Ollama, leitura das respostas).

## Por que sem dependências? (nota técnica)

O back-end usa **só a biblioteca padrão do Node** (`http`, `fs`, `crypto`) —
sem Express e sem `npm install`. Assim o sistema roda em qualquer computador
com o Node instalado, sem problemas de rede, versão ou compilação.

- **Servidor HTTP**: roteador pequeno em `server/router.js`.
- **Banco de dados**: SQLite embutido no Node (`node:sqlite`, Node 22.13+),
  sem pacote do npm. Detalhes na seção "Banco de dados" abaixo.
- **Senhas**: hash com `crypto.scrypt`.

## Banco de dados (SQLite)

O banco é um único arquivo, `data/apoio.sqlite` (o SQLite pode criar ao
lado dois arquivos auxiliares, `-wal` e `-shm`: não apague com o sistema
aberto).

- **Tabelas e regras** em `server/db/schema.js`. O próprio banco recusa dados
  quebrados: e-mail repetido, aluno em turma inexistente, idade fora de 0–6,
  nome vazio, turma com nível inválido, mais de uma atividade em andamento
  por aluno.
- **Exclusões**: turma com alunos ou professoras não pode ser excluída;
  excluir um aluno apaga junto as observações, atividades e registros dele;
  excluir uma professora apaga a conta de acesso, mas mantém o histórico de
  registros (só sem a professora ligada).
- **Transações**: gravações que andam juntas (professora + conta de acesso,
  resultado da atividade + registro) são "tudo ou nada".
- **Atualizações do sistema**: a estrutura do banco tem número de versão.
  Mudanças futuras entram como uma nova versão no fim da lista em
  `server/db/schema.js` e são aplicadas sozinhas ao iniciar, sem apagar
  dados. Nunca edite uma versão já publicada.
- **Testes**: `npm run testar` confere as regras do banco e da API numa
  pasta temporária (variável `DATA_DIR`), nunca no banco real.

## Como o sistema é usado

**Professora** (menu: Atendimento rápido, Meus alunos, Deficiências, Meu perfil)
- **Atendimento rápido:** escolhe o aluno, o tema e o objetivo da BNCC. A IA
  gera 3 atividades em 1 a 3 minutos, cada uma aparecendo assim que fica
  pronta. Se a conexão cair (celular), a geração continua e a tela
  reconecta. Se faltar alguma, há o botão "Gerar as que faltaram".
- **Escolher e registrar:** escolhe uma atividade, aplica e registra o
  resultado (funcionou / parcialmente / não funcionou). Atividades que não
  funcionaram não são sugeridas de novo para aquele aluno.
- **O que ela vê:** só os alunos **ativos** das turmas dela, no ano letivo
  atual.

**Coordenação** (menu: Painel, Turmas, Professoras, Alunos, Deficiências,
Histórico, IA, Meu perfil)
- **Painel:** números do ano, pendências (turma sem professora, aluno sem
  deficiência ligada...) e as últimas atividades.
- **Turmas:** cadastro, vínculo de professoras pela própria turma e
  **virada do ano letivo**. Na virada, cada turma passa os alunos para uma
  turma nova ou os alunos concluem. O histórico do ano anterior fica guardado.
- **Alunos:** cadastro completo, dados pessoais e **situação** (ativo,
  transferido, concluiu, saiu). Aluno que sai não é apagado: some das telas
  das professoras e o histórico continua guardado.
- **Histórico:** todas as ações, com filtros por pessoa, ação, assunto e
  período.
- **Listas:** todas têm busca e filtros.

## Estrutura de pastas

```
apoio-estudante-app/
  server/
    index.js              ponto de entrada do servidor
    router.js             roteador HTTP minimalista
    store.js              banco de dados (SQLite): leitura, gravação, transações, backup
    db/                   estrutura das tabelas (schema.js), conversão e mensagens de erro
    tools/                backup para pendrive, senha esquecida e migração de computador
    session.js            sessões de login
    config.js             configuração (.env)
    ai/                   pedidos à IA, prompts, conexão com o Ollama, fila de geração
    access/               quem pode ver qual aluno
    security/             tentativas de login, acesso pela rede (HTTPS/Tailscale)
    middleware/           exige login/papel, troca obrigatória de senha, bloqueio de outros sites
    backup/               backup diário do banco
    engine/               liga o aluno ao registro certo da base de deficiências
    routes/               endpoints da API (/api/...)
    seedData/             dados iniciais (BNCC, necessidades, demonstração)
    util/                 hash de senha, regras de senha, cabeçalhos de segurança, auditoria
  public/
    index.html            estrutura de todas as telas
    app.js                início: login, menu por papel e troca de telas
    css/                  estilos por assunto (cores só em tokens.css)
    js/core.js            núcleo: estado, chamadas à API, avisos, confirmação
    js/                   um módulo por tela: atendimento rápido, meus alunos,
                          deficiências, painel, turmas, professoras, alunos,
                          histórico, perfil, virada de ano, IA, troca de senha
  data/                   apoio.sqlite e backups (criado automaticamente, fora do git)
  tests/                  testes automáticos (npm run testar)
  bench/                  ensaios de desempenho (npm run medir) e de tempo da IA
  backup-pendrive.bat     cópia do banco para pendrive
  recuperar-acesso.bat    senha da coordenação esquecida (pede administrador do Windows)
  migrar.bat              traz todos os dados de outro computador pela rede (troca de máquina)
  windows/                sempre no ar (tarefa do Windows), ícone perto do relógio
                          com aviso ao desligar, configuração do celular
  instalador/             instalador do Windows (Inno Setup) e a arte dele
  docs/                   manual de acesso pelo celular e de troca de computador
  .env.example            modelo de configuração
  iniciar.bat             dois cliques para rodar o sistema
```

## Contas e permissões

| Papel        | Vê dados pedagógicos | Vê dados pessoais/administrativos | Cadastra turmas/professoras/alunos |
|--------------|:---------------------:|:----------------------------------:|:------------------------------------:|
| Professora   | ✅                     | ❌                                   | ❌                                     |
| Coordenação  | ✅                     | ✅                                   | ✅                                     |

A separação acima é garantida pelo servidor (`server/access/studentAccess.js`
e `server/routes/`), não apenas pela interface. A professora só vê alunos
**ativos** das turmas dela no ano letivo atual. Só a professora gera
atividades: quem aplica é ela, e assim o computador fica livre para ela.
