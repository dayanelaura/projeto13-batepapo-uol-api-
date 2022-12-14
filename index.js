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
    const partic_array = await db.collection("participantes").find().toArray();
    const existente = partic_array.find( value => value.name.toLowerCase() === req.body.name.toLowerCase() );

    if(existente!==undefined)
        return res.status(409).send("Usuário já existente");

    const dia = dayjs().format();
    const hora = dia.slice(11,19); 

    try {
        const participante = req.body;
        const validation = userSchema.validate(participante, { abortEarly: false });
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
            time: hora
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

        const dia = dayjs().format();
        const hora = dia.slice(11,19); 

        const mensagem = req.body;
        const validation = messageSchema.validate(mensagem, { abortEarly: false });
        if(validation.error){
            const erros = validation.error.details;
            const errosTXT = erros.map(erro => erro.message);
            return res.status(422).send(errosTXT);
        }    

        const { to, text, type } = req.body;
        await db.collection("mensagens").insertOne({
                to: to,
                text: text,
                type: type,
                from: req.headers.user,
                time: hora
        });

        res.sendStatus(201);
    } catch (error) {
        res.sendStatus(422);
    }
})

app.get('/messages', async (req, res) => {
    try {
        const mensagensAll = await db.collection("mensagens").find().toArray();

        const mensagens = await mensagensAll.filter((mensagem) =>
                (mensagem.to === req.headers.user || mensagem.from === req.headers.user || mensagem.type === "message" || mensagem.to === 'Todos')
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

app.post('/status', async (req, res) => {
    try {
        const partCollection = await db.collection("participantes");
        const usuario = await partCollection.findOne({name: req.headers.user});
        
        if(!usuario)
            return res.sendStatus(404);
        
        await partCollection.updateOne({ 
			name: req.headers.user 
            }, { $set: { lastStatus: Date.now() } }
        );

        res.sendStatus(200);
    } catch (error){
        res.sendStatus(404);
    }
});

async function monitorarStatus(){   

    const tempoMax = Date.now() - 10000;
    try{
        const partic_Array = await db.collection("participantes").find().toArray();
        const inativos = partic_Array.filter((usuario) => usuario.lastStatus < tempoMax);
    
        if(!inativos)
            return;
        
        const dia = dayjs().format();
        const hora = dia.slice(11,19); 

        inativos.forEach((participante) => {
            db.collection("participantes").deleteOne({ name: participante.name });
            db.collection("mensagens").insertOne({
                from: participante.name, 
                to: 'Todos', 
                text: 'sai da sala...', 
                type: 'message', 
                time: hora
            });
        });
    } catch(error){
        console.log(error);
    }
}
setInterval(monitorarStatus, 15000);

app.listen(5000);