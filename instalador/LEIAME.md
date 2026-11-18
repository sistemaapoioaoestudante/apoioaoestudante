# Instalador do Windows

Gera o `instalar-apoio-ao-estudante-<versão>.exe` (ex: `instalar-apoio-ao-estudante-1.0.6.exe`), o instalador que a escola usa.

## O que ele faz

1. Pergunta se é a **primeira instalação** ou uma **troca de computador**.
2. Pede o **e-mail e a senha da coordenação** (primeira instalação) e o
   **modelo de IA** (rápido `llama3.2` ou detalhado `qwen2.5:7b`).
3. Baixa e instala o que faltar: **Node.js**, **Ollama** e, se marcado,
   **Tailscale**. Depois baixa o modelo de IA.
4. Cria o banco da escola vazio, só com a conta da coordenação (na troca de
   computador, os dados vêm do computador antigo pelo `migrar.bat`).
5. Deixa o sistema **sempre no ar** (`windows/tarefa.ps1` + `windows/servico.cmd`):
   tarefa do Windows que abre o sistema quando o computador liga, como
   serviço, e o reabre se fechar.
6. Coloca o **ícone perto do relógio** (`windows/bandeja.ps1`): mostra se o
   sistema está no ar e faz o Windows avisar antes de desligar o computador.
7. Opcional: não deixa o computador suspender na tomada.

Instalar por cima **mantém** a pasta `data` (dados da escola) e o `.env`.
Desinstalar remove o sistema e a tarefa, mas **não apaga** a pasta `data`.

## Como gerar o instalador

Precisa do [Inno Setup 6](https://jrsoftware.org/isinfo.php) (gratuito).

```bash
powershell -ExecutionPolicy Bypass -File instalador\gerar-arte.ps1
```

```bash
"%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" instalador\apoio-estudante.iss
```

O primeiro comando só é preciso se mudar a identidade visual (gera
`arte/icone.ico`, `arte/lateral.bmp` e `arte/topo.bmp` com as cores do
sistema). O resultado fica em `instalador/saida/` (fora do Git; publicado
na página **Releases** do repositório).

## Antes de publicar uma versão nova

- Atualize `Versao` no topo do `apoio-estudante.iss`.
- Se trocar a versão do Node.js, atualize `NodeVersao` (precisa ser 22.13
  ou mais nova, por causa do banco SQLite embutido).
- O instalador não tem assinatura digital: na primeira vez, o Windows pode
  mostrar "O Windows protegeu o computador". Clique em **Mais informações →
  Executar assim mesmo**.
