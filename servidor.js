const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const PORT = 8766;
const ENDPOINT_API = 'https://facilzap.app.br/mariapititicakids/integracoes/produtos_json';

const MIMES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function servirArquivo(caminho, res) {
    fs.readFile(caminho, (err, data) => {
        if (err) {
            res.writeHead(404);
            return res.end('404 - Arquivo nao encontrado: ' + caminho);
        }
        const ext = path.extname(caminho).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIMES[ext] || 'application/octet-stream',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(data);
    });
}

function proxyAPI(res) {
    const requisicao = https.get(ENDPOINT_API, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (resposta) => {
        let dados = '';
        resposta.on('data', (chunk) => dados += chunk);
        resposta.on('end', () => {
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
            });
            res.end(dados);
        });
    });
    requisicao.on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ erro: 'Falha ao acessar a API da loja', detalhe: err.message }));
    });
    requisicao.end();
}

const servidor = http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') url = '/visualizar_estoque_api.html';

    if (url === '/api/produtos') {
        return proxyAPI(res);
    }

    const caminhoSeguro = path.normalize(path.join(process.cwd(), url)).replace(/^(\.\.[\/\\])+/, '');
    servirArquivo(caminhoSeguro, res);
});

servidor.listen(PORT, () => {
    console.log('=========================================');
    console.log('  Servidor Proxy do Estoque - ONLINE 🌐');
    console.log('=========================================');
    console.log('');
    console.log('Acesse a pagina no navegador:');
    console.log(`  http://localhost:${PORT}/`);
    console.log('');
    console.log('Endpoint proxy (JSON puro):');
    console.log(`  http://localhost:${PORT}/api/produtos`);
    console.log('');
    console.log('Pressione Ctrl+C para encerrar.');
    console.log('=========================================');
});
