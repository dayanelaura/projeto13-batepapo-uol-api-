import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import joi from 'joi';
import dayjs from "dayjs";

const userSchema = joi.object({
    name: joi.string().min(1).required(),
});

const messageSchema = joi.object({
    to: joi.string().required().min(1), 
    text: joi.string().required().min(1), 
    type: joi.string().valid('message').valid('private_message').required()
});

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
  
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
try {
    await mongoClient.connect();
    db = mongoClient.db("usuarios");
} catch(error) {
    console.log(error);
}

app.post('/participants', async (req, res) => {
    if(await db.collection("participantes").findOne({name: `${req.body.name}`})) {
        return res.status(409).send("Usuário já existente");
    }   

    let hh = (new Date).getUTCHours();
    const mm = (new Date).getUTCMinutes();
    const ss = (new Date).getUTCSeconds();

    if(hh<=0)
        hh=hh+3;

    try {
        const participante = req.body;
        const validation = userSchema.validate(participante, { abortEarly: false });
        console.log(validation);
        if(validation.error){
            const erros = validation.error.details;
            const errosTXT = erros.map(erro => erro.message);
            return res.status(422).send(errosTXT);
        }       
        
        const { name } = req.body;
        await db.collection("participantes").insertOne({
            name: name, 
            lastStatus: Date.now()
        });   
        await db.collection("mensagens").insertOne({
            from: name, 
            to: 'Todos', 
            text: 'entra na sala...', 
            type: "message", 
            time: `${hh-3}:${mm}:${ss}`
        });      

        return res.sendStatus(201);
    } catch(err) {
        return res.status(422).send("Dados inválidos");
    }
});

app.get('/participants', async (req, res) => {
    try {
        const participantes = await db.collection("participantes").find().toArray();
        res.send(participantes);
    } catch(err) {
        console.log(err);
        res.sendStatus(500);
    }
});

app.post('/messages', async (req, res) => {
    try {
        if(!(await db.collection("participantes").findOne({name: req.headers.user})))
            return res.status(422).send("Usuário não cadastrado");
        if(!(await db.collection("participantes").findOne({name: req.body.to})))
            return res.status(422).send("Destinatário não encontrado na lista de participantes");

        const hh = (new Date).getUTCHours();
        const mm = (new Date).getUTCMinutes();
        const ss = (new Date).getUTCSeconds();
    
        if(hh<=0)
            hh=hh+3;

        const mensagem = req.body;
        const validation = messageSchema.validate(mensagem, { abortEarly: false });
        console.log(validation);
        if(validation.error){
            const erros = validation.error.details;
            const errosTXT = erros.map(erro => erro.message);
            return res.status(422).send(errosTXT);
        }    

        const { to, text, type } = req.body;
        await db.collection("mensagens").insertOne({
                to,
                text,
                type,
                from: `${req.headers.user}`,
                time: `${hh-3}:${mm}:${ss}`
        })
    
        res.sendStatus(201);
    } catch (error) {
        res.sendStatus(422);
    }
})

app.get('/messages', async (req, res) => {
    try {
        const mensagensAll = await db.collection("mensagens").find().toArray();

        const mensagens = await mensagensAll.filter((mensagem) =>
                (mensagem.to === req.headers.user || mensagem.from === req.headers.user || mensagem.type === "message")
        );
        
        const tamanho = mensagens.length;
        if(req.query.limit){
            const limite = Number(req.query.limit);
            const ultimasMensagens = mensagens.filter((mensagem, index) => (index >= tamanho-limite));
            return res.send(ultimasMensagens);
        }
        res.send(mensagens);
    } catch (error){
        console.log(error);
        res.sendStatus(500);
    }
});

app.listen(5000);