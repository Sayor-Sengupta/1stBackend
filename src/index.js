import dotenv  from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";
dotenv.config({
    path:'./env'
})



connectDB().then(()=>{
  app.listen(process.env.PORT || 6000,()=>{
    console.log((`server is running at : ${process.env.PORT}`));
  })
}).catch((err)=> console.log("Mongo Db connectio failed !!!",err));














/* aprroach one for connect of db
const app = express()
(async ()=>{
    try {
      await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
      app.on("error",(error)=> {
        console.log("ERR:",error);
        throw error      
        
      })
      app.listen(process.env.PORT,()=>{
        console.log(`process listening at ${process.env.PORT}`);
    })
    } catch (error) {
        console.log("error",error);
        throw err
    }
})()
*/