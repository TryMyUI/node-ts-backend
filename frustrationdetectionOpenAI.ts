const { Configuration, OpenAIApi } = require("openai");
const fs = require('fs');
const {encode, decode} = require('gpt-3-encoder')
export {};

/*
    * Prompt header for frustration and confusion
*/
const promptHeader: string = `
The following is a single part of a transcript, please return the same part back to me indicating whether the part displays a level of frustration and/or confusion and why. Include the timestamp in the statement that you return. Please return your results in the following format:

TIMESTAMP: <TIMESTAMP>
FRUSTRATION FLAG: <BINARY VALUE FOR FRUSTRATION (YES OR NO)>
CONFUSION FLAG: <BINARY VALUE FOR CONFUSION (YES OR NO)>
INSTRUCTION FLAG: <BINARY VALUE FOR WHETHER OR NOT THIS IS AN INSTRUCTION (YES OR NO)>
REASON FOR FRUSTRATION: <REASON FOR FRUSTRATION (RETURN NULL IF NO FRUSTRATION -- NO EXPLANATION IS REQUIRED)>
REASON FOR CONFUSION: <REASON FOR CONFUSION (RETURN NULL IF NO CONFUSION -- NO EXPLANATION IS REQUIRED)>
END: <INSERT THE STRING END-FINALITY>


Here is the segment:
`;

/*
    * Global Credentials and configuration for OpenAI API
*/
const OPENAI_API_KEY = "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";
const configuration = new Configuration({
    apiKey: OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);


/*
    * Read local file and return data
*/
export const readLocalFile =  (filePath: string) =>  {
    const data = fs.readFileSync(filePath, 'utf8');
    return data;
}


/*
    * Reads in a json response either from a file or from a api response
*/
const readJSON = (filePathBool: boolean, jsonPath: any): string => {
    let jsonObj: any;
    if (filePathBool) {
      jsonObj = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } else {
      jsonObj = JSON.parse(jsonPath);
    }
  
    const data: string[] = [];
    for (let json of jsonObj) {
      data.push(json.timestamp + '\n' + json.content);
    }
  
    // console.log(jsonObj)
    return data.join('\n\n');
  };
  

/*
    * Return token count for OpenAI API response
*/
const tokenCount = async (resp: string, tokenThreshold: number): Promise<number> => {
    const encoded: string = encode(resp)
    const tokenCount: number = encoded.length;
    return tokenCount;
}


/*
    * Interface for Frustration and Confusion response
*/
interface FrustrationConfusion {
    timestamp: string;
    frustrationFlag: string;
    confusionFlag: string;
    instructionFlag: string;
    reasonForFrustration: string;
    reasonForConfusion: string;
}
  
/*
    * Function to grab frustration and confusion data from OpenAI API
*/
const grabOpenAIData = async (openaiAPIHandler: typeof OpenAIApi, prompt: string, transcriptPath: any, transcriptFPBool: boolean): Promise<string[]> => {
    
    //Grabbing the prompt and transcript from local files
    const transcript: string = readJSON(transcriptFPBool, transcriptPath);

    //Splitting the transcript into blocks
    const transcriptSplit: string[] = transcript.split('\n\n');

    // Mapping the prampt to each transcript split
    const mappedTranscriptSplit: string[] = transcriptSplit.map((block: string) => {    
        return prompt + '\n\n' + block;
    })
    // console.log(`mappedTranscriptSplit Length: ${mappedTranscriptSplit.length}`);
    // console.log(`transcriptSplit Length: ${transcriptSplit.length}`);



    //Grabbing the response from OpenAI API
    let resonseArray: string[] = [];
    for (let block of mappedTranscriptSplit) {
        try {
            const completion = await openaiAPIHandler.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages: [{"role": "assistant", "content": "\n\n" + block}],
                temperature: 0.2,
            });
            resonseArray.push(completion.data.choices[0].message.content);
    
          } catch (error: any) {
            if (error.response) {
              console.log(error.response.status);
              console.log(error.response.data);
            } else {
              console.log(error.message);
            }
          }
    }
    
    // Joining the response array
    const response: string = resonseArray.join('\n\n');
    // console.log(response)
    return resonseArray;
    
}

/*
    * Utility Function to clean the response list into a dictionary
*/
const parseOpenAIResponse = async (openaiAPIResponse: string[]): Promise<FrustrationConfusion[]> => {
    const processedResponse: FrustrationConfusion[] = [];
    for(let response of openaiAPIResponse) {
        // console.log(response);
        const startIndex = response.indexOf('TIMESTAMP');
        const endIndex = response.indexOf('END-FINALITY');
        const extractedStr = response.substring(startIndex, endIndex).trim();
        const arr = extractedStr.split('\n').splice(0,6);
        const timestamp = '(' + arr[0].slice(11, arr[0].length) + ')';
        // console.log(arr);
        const obj: FrustrationConfusion = {
            timestamp: timestamp,
            frustrationFlag: arr[1].split(':')[1].trim(),
            confusionFlag: arr[2].split(':')[1].trim(),
            instructionFlag: arr[3].split(':')[1].trim(),
            reasonForFrustration: arr[4].split(':')[1].trim(),
            reasonForConfusion: arr[5].split(':')[1].trim(),
        };

        // checking to see if the instruction flag is false
        // console.log(obj);
        if (obj.instructionFlag === 'NO') {
            processedResponse.push(obj);
        }

    }
    
    return processedResponse;
}

/*
    * Wrapper function to generate a json
*/
const openaiAPIResponseParser = async (transcriptFPBool: boolean, transcriptPath: any): Promise<string> => {
    const openaiAPIResponse: string[] = await grabOpenAIData(openai, promptHeader, transcriptPath, transcriptFPBool).then(resp => resp);
    const parsedResponse: Object = await parseOpenAIResponse(openaiAPIResponse).then(resp => resp);
    const jsonResp: string = JSON.stringify(parsedResponse);
    // console.log(typeof jsonResp);
    return jsonResp;
}
// openaiAPIResponseParser().then(resp => console.log(resp));

openaiAPIResponseParser(true, './transcript.json').then(resp => console.log(resp))
