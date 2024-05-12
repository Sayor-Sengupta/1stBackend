import { v2 as cloudinary } from "cloudinary";

import fs from 'fs'


          
cloudinary.config({ 
  cloud_name: process.env.CLOUDNARY_CLOUD_NAME, 
  api_key: process.env.CLOUDNARY_API_KEY, 
  api_secret: process.env.CLOUDNARY__API_SECURITY 
});

const uploadOnCLoudnary = async (localFilePath)=>{
    try{
        if(!localFilePath) return null
        //upload files
        const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type:"auto"
        })
        //file has been uploaded successfully
        // console.log("file is uploaded on cloudinary",response.url);
        fs.unlinkSync(localFilePath)
        // console.log(response);
        return response;
       

    }
    catch(error){
        fs.unlinkSync(localFilePath) // remove the locally saved temp file as the upload operation got failed
        return null
        
    }
}


  export {uploadOnCLoudnary}