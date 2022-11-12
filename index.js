import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import joi from 'joi';
import dayjs from "dayjs";

/* const userSchema = joi.object({
    name: joi.string().required(),
    to: joi.string().required(),
    text: joi.string().required(),
    //type: joi.string().required(),
    //lastStatus: joi.number().required()
  }); */

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
    try {
        const participante = await db.collection("participantes").insertOne({
            name: `${req.body.name}`, 
            lastStatus: Date.now()
        });       
        const mensagem = {
            from: 'xxx', 
            to: 'Todos', 
            text: 'entra na sala...', 
            type: 'status', 
            time: 'HH:MM:SS',
        }       
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
        const { to, text, type } = req.body;
        const hh = (new Date).getUTCHours();
        const mm = (new Date).getUTCMinutes();
        const ss = (new Date).getUTCSeconds();
        
        const mensagem = await db.collection("mensagens").insertOne({
                to,
                text,
                type,
                from: req.headers.user,
                time: `${hh-3}:${mm}:${ss}`
        })
    
        res.sendStatus(201);
    } catch (error) {
        res.status(422).send("Dados inválidos");
    }
})

app.get('/messages', async (req, res) => {
    try {
        const mensagens = await db.collection("mensagens").find().toArray();
        res.send(mensagens);
    } catch (error){
        console.log(error);
        res.sendStatus(500);
    }
});

app.listen(5000);