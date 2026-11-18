// Testes da atualizacao do sistema (server/updates/updater.js): comparar
// versoes e ler a versao publicada. Nao acessam a internet.
process.env.UPDATE_CHECK = "0";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { compareVersions, readRelease } = require("../server/updates/updater");

test("compara versoes numero a numero (1.0.10 e maior que 1.0.9)", () => {
  assert.ok(compareVersions("1.0.10", "1.0.9") > 0);
  assert.ok(compareVersions("v1.1.0", "1.0.99") > 0);
  assert.equal(compareVersions("1.0.9", "v1.0.9"), 0);
  assert.ok(compareVersions("1.0.8", "1.0.9") < 0);
});

test("le a versao publicada e a assinatura (SHA-256) do instalador", () => {
  const hash = "a".repeat(64);
  const release = readRelease({
    tag_name: "v1.2.3",
    body: "Novidades",
    html_url: "https://github.com/dono/versoes/releases/tag/v1.2.3",
    assets: [
      { name: "leia-me.txt", browser_download_url: "https://x/leia-me.txt", size: 10 },
      { name: "instalar-apoio-ao-estudante-1.2.3.exe", browser_download_url: "https://x/i.exe", size: 2000000, digest: `sha256:${hash}` }
    ]
  });
  assert.equal(release.latest, "1.2.3");
  assert.equal(release.asset.name, "instalar-apoio-ao-estudante-1.2.3.exe");
  assert.equal(release.asset.sha256, hash);
});

test("instalador sem assinatura fica sem sha256 (nao instala sozinho)", () => {
  const release = readRelease({
    tag_name: "v2.0.0",
    assets: [{ name: "instalar-apoio-ao-estudante-2.0.0.exe", browser_download_url: "https://x/i.exe", size: 100 }]
  });
  assert.equal(release.asset.sha256, null);
});

test("versao em formato estranho e recusada", () => {
  assert.throws(() => readRelease({ tag_name: "ultima", assets: [] }));
});

test("pagina da versao so e aceita se for do GitHub", () => {
  const release = readRelease({ tag_name: "v1.0.0", html_url: "https://exemplo.com/falso", assets: [] });
  assert.equal(release.pageUrl, "");
});
