import { Component } from '@angular/core';
import { CodeBuildClient, StartBuildCommand } from "@aws-sdk/client-codebuild"; // ES Modules import
import { fromIni } from "@aws-sdk/credential-providers";
import {
  ReceiveMessageCommand,
  DeleteMessageCommand,
  DeleteMessageBatchCommand,
  PurgeQueueCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { NgxSpinnerService } from 'ngx-spinner';
import { environment } from 'src/environments/environment';
environment


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  constructor(private spinner: NgxSpinnerService) {

  }


  title = 'codebuild';
  profile= {"accessKeyId":environment.accessKeyId,"secretAccessKey":environment.secretAccessKey,"sessionToken":environment.sessionToken}



  client = new SQSClient({
    region: "us-east-1",
    credentials: this.profile,
  });

  SQS_QUEUE_URL =
    "https://sqs.us-east-1.amazonaws.com/232100869787/Shuaiqueue";


  phaseStatus:string=''
  completedPhase:string=''
  phaseStart:string=''
  phaseLogs:string[]=[];
  isStartBuild=false;



purge=async () =>{
    const input = { // PurgeQueueRequest
      QueueUrl: this.SQS_QUEUE_URL, // required
    };
  const command = new PurgeQueueCommand(input);
  const response = await this.client.send(command);
  console.log(response);


  }

   async StartBuild() {
    this.phaseLogs=[];
    try{
      this.isStartBuild=true
      await this.purge()
      this.phaseLogs.push('Start build...')
    // const { CodeBuildClient, StartBuildCommand } = require("@aws-sdk/client-codebuild"); // CommonJS import
    const client = new CodeBuildClient({
      region: "us-east-1",
      credentials: this.profile
    });
    const input = {
      // StartBuildInput
      projectName: "code-commit-test", // required
    };
    const command = new StartBuildCommand(input);
   const response = await client.send(command);

    console.log(response);
    await this.main()
  }catch(ex){
    console.log(ex);
    this.phaseLogs.push(ex as string)
  }finally{
  }
  }



 receiveMessage = (queueUrl:string) =>
  this.client.send(
    new ReceiveMessageCommand({
      AttributeNames: ["SentTimestamp"],//Returns the time the message was sent to the queue
      MaxNumberOfMessages: 1,
      MessageAttributeNames: ["all"],
      QueueUrl: queueUrl,
      VisibilityTimeout: 20,//The duration (in seconds) that the received messages are hidden from subsequent retrieve requests after being retrieved by a ReceiveMessage request.
      WaitTimeSeconds: 20,
    })
  );





   main = async (queueUrl = this.SQS_QUEUE_URL) => {
    const { Messages } = await this.receiveMessage(queueUrl);

        if (Messages!==undefined && Messages.length === 1) {
          console.log(Messages[0].Body);
          this.phaseStatus= JSON.parse(Messages[0].Body as string).detail['completed-phase-status']

          this.completedPhase= JSON.parse(Messages[0].Body as string).detail['completed-phase']
          this.phaseStart=JSON.parse(Messages[0].Body as string).detail['completed-phase-start']

          this.phaseLogs.push(this.completedPhase+' '+this.phaseStatus+' '+this.phaseStart)
          await this.client.send(
            new DeleteMessageCommand({
              QueueUrl: queueUrl,
              ReceiptHandle: Messages[0].ReceiptHandle,
            })
          ).then(
             (value) => {
              console.log(value); // 成功！
              this.main();

            },
            (reason) => {
              console.error(reason); // 错误！
            },
          );;
        } else if (Messages!==undefined && Messages.length > 1) {
          await this.client.send(
            new DeleteMessageBatchCommand({
              QueueUrl: queueUrl,
              Entries: Messages.map((message) => ({
                Id: message.MessageId,
                ReceiptHandle: message.ReceiptHandle,
              })),
            })
          );
        }else{
          this.main()
        }

    };

}
