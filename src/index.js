import { Storage } from '@google-cloud/storage'
import dauria from 'dauria'
const { getBase64DataURI, parseDataURI } = dauria
import toBuffer from 'concat-stream'
import mimeTypes, { contentType } from 'mime-types'
import crypto from "crypto"
// import from2 from 'from2'
import { Readable } from 'stream'
import { randomUUID } from 'crypto'
// import { write } from 'fs'

// class PercentStream extends Writable {
//   _write(chunk, enc, next) {
//     console.log(chunk.toString());
//     next();
//   }
// }


// function getOutputWithDelay() {
//   
//   output.write('hello');

//   setTimeout(() => {
//     output.end();
//   }, 3000);

//   return output;
// }

function uploadFile(stream, file, closeOut) {
  const fileSize = file.size;
  const writeStream = file.createWriteStream({ resumable: false });
  const output = new Readable({read(){}});

  let bytesWritten = 0
  let current
  // stream is a readable stream that emits data to the writeStream
  stream.pipe(writeStream)
  .on('progress', (chunk) => {
    let bytesWritten = chunk.bytesWritten
    const percentage = Math.floor((chunk.bytesWritten / fileSize) * 100);
    if(current !== percentage){
      output.push(JSON.stringify({progress: percentage}))
      current = percentage
    }
  })
  .on('finish',async ()=>{
    await closeOut();
    // output.destroy();
    // output.end();
    output.push(JSON.stringify({
      progress: percentage,
      sent: bytesWritten,
      size: fileSize,
      originalname: file.id,

      // ...
    }))
    output.push(null);
  })

  return output;
}


export class UploadsService {
  constructor(options) {
    this.options = options
    this.bucketName = options.bucket || 'uploads'

    this.storage = new Storage({
      apiEndpoint: "http://localhost:8080",
      projectId: "test",
    });
    this.bucket = this.storage.bucket(this.bucketName);
    this.bucket.create(function(err, bucket, apiResponse) {
      if (err){
        if(err.code == 409) {
          console.log('bucket already exists')
        }else{
          console.error(err)
        }
      }else{
        console.log('bucket created successfully')
      }
    });

  }

  async find(_params) {
    return []
  }

  async get(id, _params) {
    return {
      id: 0,
      text: `A new message with ID: ${id}!`
    }
  }
  async create(data, params) {

    // if (!id) {
    //   const hash = bufferToHash(buffer);
    //   id = `${hash}.${ext}`;
    // }




    

    if(params?.file?.stream){
      // {
      //   fieldName: "file",
      //   originalName: "IMG_1672_y.mp4",
      //   clientReportedMimeType: "application/octet-stream",
      //   clientReportedFileExtension: ".mp4",
      //   path: "/var/folders/gn/ms8nk_1j1n1g7f9ffzmcq85w0000gp/T/M3NJN70",
      //   size: 106819221,
      //   detectedMimeType: "video/mp4",
      //   detectedFileExtension: ".mp4",
      //   stream
         
      // }
      let { stream, originalName, size, detectedMimeType } = params.file

      let contentType = detectedMimeType

      // Unrocognized mime type
      let ext = mimeTypes.extension(contentType);
      if ((typeof ext === 'boolean') && !ext) {
        // Fallback to binary content
        ext = 'bin';
        contentType = 'application/octet-stream';
      }

      // if ID does not exist
      // create temp ID
      let tempId = randomUUID()
      let tempFileName = `${tempId}.${ext}`;
      // write file to that id
      let file = this.bucket.file(tempFileName);

      // create a write stream for the new file in GCS
      const writeStream = file.createWriteStream({ resumable: false });
      // create an output stream that you will share back to client
      const output = new Readable({read(){}});

      // set up percentage tracking 
      let bytesWritten = 0
      let current = null;
      const hash = crypto.createHash('sha256'); // Create a hash object

      // pipe request stream into write stream
      stream.pipe(hash)
      stream.pipe(writeStream)
      .on('progress', (chunk) => {
        // update bytes counter
        bytesWritten = chunk.bytesWritten
        // update percentage
        const percentage = Math.floor((chunk.bytesWritten / size) * 100);
        if(current !== percentage){
          // write to client the new percentage json
          output.push(JSON.stringify({progress: percentage})+'\n')
          current = percentage
        }
      })
      .on('finish',async ()=>{
        const fileHash = hash.digest('hex'); // Get the file hash as a hexadecimal string

        // rename the file 
        let metadata = {
          ...data,
          originalName,
          contentType,
          tempFileName,
          size,
        }
        Object.keys(metadata).forEach(key => {
          metadata[key] = metadata[key].toString();
        });
        

        await file.setMetadata({metadata});
        await file.move(`${fileHash}.${ext}`);

        // set the metadata

        // send the results back

        // output the final data.
        output.push(JSON.stringify({
          progress: current,
          sent: bytesWritten,
          contentType,
          size,
          originalName,
          id: fileHash,
          name: `${fileHash}.${ext}`,
        })+'\n')

        // close the stream
        output.push(null);
      })

      return output;

    }
   
   
   
    // if (uri) {
    //   const result = parseDataURI(uri);
    //   contentType = result.MIME;
    //   buffer = result.buffer;
    // } else {
    //   uri = getBase64DataURI(buffer, contentType);
    // }

    // if (!uri && (!buffer || !contentType)) {
    //   throw new errors.BadRequest('Buffer or URI with valid content type must be provided to create a blob');
    // }




    // check if bucket exists
    // if no, error

    // check if file exists
    // if yes, return location
    // if no, upload
    // await file.save(buffer,{resumable:false})
    await file.setMetadata({metadata:{
        ...rest,
        id,
        originalname:rest.name
      }
    });



  }

  // This method has to be added to the 'methods' option to make it available to clients
  async update(id, data, _params) {
    return {
      id: 0,
      ...data
    }
  }

  async patch(id, data, _params) {
    return {
      id: 0,
      text: `Fallback for ${id}`,
      ...data
    }
  }

  async remove(id, _params) {
    return {
      id: 0,
      text: 'removed'
    }
  }
}

export const getOptions = (app) => {
  return { 
    app,
    token:'XXXX',
    baseURL: 'http://localhost:8080',
    uploadBaseURL: 'http://localhost:8080/upload_folder',
    defaults:{
      'Authorization': "Bearer " + 'XXXX'
    },
    bucket: 'bucket',
    fileField: 'uploaded',
    idField: 'id'
  
  }
}


// function fromBuffer (buffer) {
//   // assert.ok(Buffer.isBuffer(buffer))
//   return from2(function (size, next) {
//     if (buffer.length <= 0) {
//       return this.push(null);
//     }
//     const chunk = buffer.slice(0, size);
//     buffer = buffer.slice(size);
//     next(null, chunk);
//   });
// };

function bufferToHash (buffer) {
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
};
