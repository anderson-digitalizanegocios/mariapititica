const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Carrega as variaveis do .env (sem dependencias externas)
const arquivoEnv = path.join(__dirname, '.env');
if (fs.existsSync(arquivoEnv)) {
    for (const linha of fs.readFileSync(arquivoEnv, 'utf8').split(/\r?\n/)) {
        const m = linha.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
}

// Usa a porta fornecida pela Render ou 8766 para testes locais
const PORT = process.env.PORT || 8766;
const ENDPOINT_API = process.env.ENDPOINT_API || '';

// Chave de acesso lida do .env (ou de variavel de ambiente)
const AUTHORIZATION = process.env.AUTHORIZATION || '';

// URL base da pagina do produto
const URL_PRODUTO = process.env.URL_PRODUTO || '';

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

const categorias = [
    { id: 434129, nome: "Calçados" },
    { id: 427981, nome: "Meninos" },
    { id: 428135, nome: "Acessórios Feminino" },
    { id: 428136, nome: "Acessórios Masculino" },
    { id: 427944, nome: "Meninas" }
]

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

function montarHeaders() {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
    };
    if (AUTHORIZATION) {
        headers['Authorization'] = /^bearer\s/i.test(AUTHORIZATION) ? AUTHORIZATION : 'Bearer ' + AUTHORIZATION;
    }
    return headers;
}

// A API da loja devolve 100 produtos por pagina
function buscarPagina(pagina) {
    return new Promise((resolve, reject) => {
        const separador = ENDPOINT_API.includes('?') ? '&' : '?';
        const requisicao = https.get(`${ENDPOINT_API}${separador}page=${pagina}`, { headers: montarHeaders() }, (resposta) => {
            let dados = '';
            resposta.on('data', (chunk) => dados += chunk);
            resposta.on('end', () => {
                try {
                    resolve(JSON.parse(dados));
                } catch (err) {
                    reject(new Error('Resposta invalida da API da loja'));
                }
            });
        });
        requisicao.on('error', reject);
        requisicao.end();
    });
}

// Junta todas as paginas em uma unica resposta para o front-end
async function proxyAPI(res) {
    try {
        const primeira = await buscarPagina(1);
        const produtos = Array.isArray(primeira.data) ? primeira.data.slice() : [];
        const total = Number(primeira.total) || produtos.length;
        const porPagina = produtos.length || total;
        const totalPaginas = porPagina ? Math.ceil(total / porPagina) : 1;

        for (let pagina = 2; pagina <= totalPaginas; pagina++) {
            const proxima = await buscarPagina(pagina);
            if (Array.isArray(proxima.data)) produtos.push(...proxima.data);
        }

        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        });
        res.end(JSON.stringify({ data: produtos, total }));
    } catch (err) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ erro: 'Falha ao acessar a API da loja', detalhe: err.message }));
    }
}

const servidor = http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    
    // Aponta para o index.html na raiz
    if (url === '/') url = '/index.html';

    if (url === '/api/produtos') {
        return proxyAPI(res);
    }

    if (url === '/api/config') {
        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        });
        return res.end(JSON.stringify({ url_produto: URL_PRODUTO, categorias }));
    }

    const caminhoSeguro = path.normalize(path.join(process.cwd(), url)).replace(/^(\.\.[\/\\])+/, '');
    servirArquivo(caminhoSeguro, res);
});

servidor.listen(PORT, () => {
    console.log('=========================================');
    console.log('  Servidor Proxy do Estoque - ONLINE 🌐');
    console.log('=========================================');
    console.log(`Servidor rodando na porta ${PORT}`);
});