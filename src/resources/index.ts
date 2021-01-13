import { CheckServerless, Resource, Serverless, FlexPlugin } from 'twilio-pulumi-provider';
import * as pulumi from '@pulumi/pulumi';

const stack = pulumi.getStack();

const serviceName = 'preview-dialer-serverless';
const domain = CheckServerless.getDomainName(serviceName, stack);

const { 
    FLEX_WORKSPACE_SID, 
    EVERYONE_TASK_QUEUE_SID,
    TWILIO_PHONE_NUMBER
} = process.env;

const flexWorkspace = new Resource("flex-workspace", {
    resource: ["taskrouter", "workspaces"],
    attributes: {
        sid: FLEX_WORKSPACE_SID
    }
});

const previewDialerWorkflow = new Resource("preview-dialer-workflow", {
    resource: ["taskrouter", { "workspaces" : flexWorkspace.sid }, "workflows"],
    attributes: {
        friendlyName: 'Preview Dialer',
        configuration: JSON.stringify(
            {
                task_routing: {
                    filters: [
                        {
                            friendlyName: "Preview Dialer",
                            expression: `
                                (taskrouter.dayOfWeek IN task.schedule.week) AND
                                (taskrouter.currentTime > task.schedule.startHour) AND
                                (taskrouter.currentTiem < task.schedule.endHour)
                            `,
                            targets: [
                                {
                                    queue: EVERYONE_TASK_QUEUE_SID
                                }   
                            ]
                        }

                    ],
                    default_filter: {
                        task_queue_sid: EVERYONE_TASK_QUEUE_SID
                    }
                }
            }
        )
    },
});

const previewDialerTaskChannel = new Resource("preview-dialer-task-channel", {
    resource: ["taskrouter", { "workspaces" : flexWorkspace.sid }, "taskChannels"],
    attributes: {
        friendlyName: 'Preview Dialer',
        uniqueName: 'preview_dialer'
    }
});

const serverless = new Serverless("preview-dialer-functions-assets", {
    attributes: {
        cwd: `../serverless/main`,
        serviceName,          
        envPath: `.${stack}.env`,
        env: {
            TWILIO_PHONE_NUMBER,
            DOMAIN: domain,
            WORKSPACE_SID: flexWorkspace.sid,
            WORKFLOW_SID: previewDialerWorkflow.sid,
            PREVIEW_DIALER_TASK_CHANNEL_SID: previewDialerTaskChannel.sid
        },
        functionsEnv: stack,
        pkgJson: require("../serverless/main/package.json")
    }
});

const previewDialerListflexPlugin = new FlexPlugin("preview-dialer-list-flex-plugin", { 
    attributes: {
        cwd: "../flex-plugins/preview-dialer-list",
        env: pulumi.all([domain]).apply(([ domain ]) => (
            {
                REACT_APP_SERVICE_BASE_URL: domain
            }
        ))
    }
});
 
export let output =  {
   flexWorkspaceSid: flexWorkspace.sid,
   previewDialerWorkflowSid: 
    previewDialerWorkflow.sid,
   previewDialerTaskChannelSid: 
    previewDialerTaskChannel.sid,
   serverlessSid: serverless.sid,
   previewDialerListflexPluginSid: 
    previewDialerListflexPlugin.sid
}
