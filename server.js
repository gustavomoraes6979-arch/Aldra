// =======================================================================
// Aldra — server.js (ERP COMPLETO + IA REAL INTEGRADA)
// =======================================================================

import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import sqlite3 from "sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { fileURLToPath } from "url";

dotenv.config();

// =======================================================================
// CONFIG
// =======================================================================

const ADMIN_EMAIL = "moraes_gu@hotmail.com".toLowerCase();
const PLAN_PRICE = 1;
const BYPASS_SUBSCRIPTION = true;

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET não definido");
if (!process.env.MP_ACCESS_TOKEN) throw new Error("MP_ACCESS_TOKEN não definido");
if (!process.env.GROQ_API_KEY) console.warn("⚠️ GROQ_API_KEY não definida");

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN.trim(),
});

const payment = new Payment(mpClient);

// =======================================================================
// PATH
// =======================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");

// =======================================================================
// APP
// =======================================================================

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// =======================================================================
// DATABASE
// =======================================================================

const db = new sqlite3.Database(path.join(__dirname, "adminIA.db"));

const dbRun = (q,p=[]) => new Promise((r,j)=>db.run(q,p,function(e){e?j(e):r(this)}));
const dbGet = (q,p=[]) => new Promise((r,j)=>db.get(q,p,(e,row)=>e?j(e):r(row)));
const dbAll = (q,p=[]) => new Promise((r,j)=>db.all(q,p,(e,rows)=>e?j(e):r(rows)));

db.serialize(()=>{

db.run(`CREATE TABLE IF NOT EXISTS users(
id INTEGER PRIMARY KEY AUTOINCREMENT,
name TEXT,
email TEXT UNIQUE,
password TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS subscriptions(
id INTEGER PRIMARY KEY AUTOINCREMENT,
user_id INTEGER UNIQUE,
status TEXT DEFAULT 'pending',
payment_id TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS clients(
id INTEGER PRIMARY KEY AUTOINCREMENT,
user_id INTEGER,
name TEXT,
email TEXT,
phone TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS products(
id INTEGER PRIMARY KEY AUTOINCREMENT,
user_id INTEGER,
name TEXT,
sku TEXT,
quantity INTEGER,
price REAL
)`);

db.run(`CREATE TABLE IF NOT EXISTS accounts(
id INTEGER PRIMARY KEY AUTOINCREMENT,
user_id INTEGER,
description TEXT,
type TEXT,
value REAL,
status TEXT DEFAULT 'pending'
)`);

});

// =======================================================================
// AUTH
// =======================================================================

async function auth(req,res,next){

const header=req.headers.authorization;
if(!header) return res.status(401).json({error:"Token ausente"});

try{

const token=header.replace("Bearer ","");
const decoded=jwt.verify(token,process.env.JWT_SECRET);

const user=await dbGet(`SELECT * FROM users WHERE id=?`,[decoded.id]);
if(!user) return res.status(401).json({error:"Usuário inválido"});

user.is_admin = user.email === ADMIN_EMAIL;

req.user=user;
next();

}catch{
res.status(401).json({error:"Token inválido"});
}

}

async function requireActive(req,res,next){

if(BYPASS_SUBSCRIPTION){
  return next();
}

const sub = await dbGet(`SELECT status FROM subscriptions WHERE user_id=?`,[req.user.id]);

if(sub?.status !== "active"){
return res.status(403).json({error:"Assinatura inativa"});
}

next();

}

// =======================================================================
// AUTH ROUTES
// =======================================================================

app.post("/auth/register", async (req,res)=>{
try{
const {name,email,password}=req.body;
const hash=bcrypt.hashSync(password,10);
const result = await dbRun(
`INSERT INTO users(name,email,password) VALUES(?,?,?)`,
[name,email.toLowerCase(),hash]
);
await dbRun(
`INSERT INTO subscriptions(user_id,status) VALUES(?, 'pending')`,
[result.lastID]
);
res.json({success:true});
}catch{
res.status(400).json({error:"Email já existe"});
}
});

app.post("/auth/login", async (req,res)=>{
const {email,password}=req.body;
const user = await dbGet(`SELECT * FROM users WHERE email=?`,[email.toLowerCase()]);
if(!user) return res.status(404).json({error:"Usuário não encontrado"});
if(!bcrypt.compareSync(password,user.password))
return res.status(401).json({error:"Senha incorreta"});
const token = jwt.sign({id:user.id},process.env.JWT_SECRET,{expiresIn:"30d"});
res.json({
token,
redirect: user.email===ADMIN_EMAIL?"/admin-dashboard.html":"/dashboard.html"
});
});

app.get("/auth/me", auth, async (req,res)=>{
const sub = await dbGet(`SELECT status FROM subscriptions WHERE user_id=?`,[req.user.id]);
res.json({
email:req.user.email,
is_admin:req.user.is_admin,
subscription_status: sub?.status || "pending"
});
});

// =======================================================================
// 🤖 IA REAL (GROQ + DADOS DO SISTEMA)
// =======================================================================

app.post("/api/ia", auth, async (req,res)=>{

try{

const { prompt } = req.body;

if(!prompt){
  return res.json({ resposta:"Digite algo." });
}

// Dados do usuário
const clients = await dbAll(`SELECT * FROM clients WHERE user_id=?`,[req.user.id]);
const products = await dbAll(`SELECT * FROM products WHERE user_id=?`,[req.user.id]);
const accounts = await dbAll(`SELECT * FROM accounts WHERE user_id=?`,[req.user.id]);

const entradas = accounts.filter(a=>a.type==="entrada").length;
const saidas = accounts.filter(a=>a.type==="saida").length;

// Contexto
const contexto = `
Dados do sistema do usuário:
Clientes: ${clients.length}
Produtos: ${products.length}
Contas: ${accounts.length}
Entradas: ${entradas}
Saídas: ${saidas}
`;

// Chamada Groq
const response = await fetch("https://api.groq.com/openai/v1/chat/completions",{
  method:"POST",
  headers:{
    "Content-Type":"application/json",
    "Authorization":"Bearer " + process.env.GROQ_API_KEY
  },
  body: JSON.stringify({
    model:"llama3-70b-8192",
    messages:[
      { role:"system", content:"Você é a IA da Aldra, especialista em gestão empresarial." },
      { role:"system", content: contexto },
      { role:"user", content: prompt }
    ]
  })
});

const data = await response.json();

const resposta =
  data?.choices?.[0]?.message?.content ||
  "Erro na IA";

res.json({ resposta });

}catch(err){
console.error(err);
res.json({ resposta:"Erro ao processar IA" });
}

});

// =======================================================================
// OUTROS MODULOS (SEM ALTERAÇÃO)
// =======================================================================

app.post("/api/pdf", auth, async (req,res)=>{
res.json({ resultado: "PDF processado (mock)" });
});

app.post("/api/cobranca", auth, async (req,res)=>{
res.json({ msg: "Cobrança criada (mock)" });
});

app.get("/api/relatorios", auth, async (req,res)=>{
res.json({
clientes: await dbAll(`SELECT COUNT(*) as total FROM clients WHERE user_id=?`,[req.user.id]),
produtos: await dbAll(`SELECT COUNT(*) as total FROM products WHERE user_id=?`,[req.user.id])
});
});

app.get("/api/contratos", auth, (req,res)=>{
res.json({ msg:"Contratos (em desenvolvimento)" });
});

app.get("/api/fiscal", auth, (req,res)=>{
res.json({ msg:"Fiscal (em desenvolvimento)" });
});

app.get("/api/certidoes", auth, (req,res)=>{
res.json({ msg:"Certidões (em desenvolvimento)" });
});

// =======================================================================
// CRM / ESTOQUE / FINANCEIRO
// =======================================================================

app.get("/crm", auth, requireActive, async (req,res)=>{
res.json(await dbAll(`SELECT * FROM clients WHERE user_id=?`,[req.user.id]));
});

app.post("/crm", auth, requireActive, async (req,res)=>{
const {name,email,phone}=req.body;
await dbRun(`INSERT INTO clients(user_id,name,email,phone) VALUES(?,?,?,?)`,
[req.user.id,name,email,phone]);
res.json({success:true});
});

app.delete("/crm/:id", auth, requireActive, async (req,res)=>{
await dbRun(`DELETE FROM clients WHERE id=? AND user_id=?`,[req.params.id,req.user.id]);
res.json({success:true});
});

app.get("/products", auth, requireActive, async (req,res)=>{
res.json(await dbAll(`SELECT * FROM products WHERE user_id=?`,[req.user.id]));
});

app.post("/products", auth, requireActive, async (req,res)=>{
const {name,sku,quantity,price}=req.body;
await dbRun(`INSERT INTO products(user_id,name,sku,quantity,price) VALUES(?,?,?,?,?)`,
[req.user.id,name,sku,quantity,price]);
res.json({success:true});
});

app.delete("/products/:id", auth, requireActive, async (req,res)=>{
await dbRun(`DELETE FROM products WHERE id=? AND user_id=?`,[req.params.id,req.user.id]);
res.json({success:true});
});

app.get("/finance/accounts", auth, requireActive, async (req,res)=>{
res.json(await dbAll(`SELECT * FROM accounts WHERE user_id=?`,[req.user.id]));
});

app.post("/finance/accounts", auth, requireActive, async (req,res)=>{
const {description,type,value}=req.body;
await dbRun(`INSERT INTO accounts(user_id,description,type,value) VALUES(?,?,?,?)`,
[req.user.id,description,type,value]);
res.json({success:true});
});

app.delete("/finance/accounts/:id", auth, requireActive, async (req,res)=>{
await dbRun(`DELETE FROM accounts WHERE id=? AND user_id=?`,[req.params.id,req.user.id]);
res.json({success:true});
});

// =======================================================================
// STATIC
// =======================================================================

app.use(express.static(PUBLIC_DIR));

app.get("/*",(_,res)=>
res.sendFile(path.join(PUBLIC_DIR,"index.html"))
);

// =======================================================================

app.listen(PORT,()=>console.log(`🚀 Aldra rodando na porta ${PORT}`));