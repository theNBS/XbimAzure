﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Azure.WebJobs;
using XbimCloudCommon;

namespace XbimModelPortalWebJob
{
    // To learn more about Microsoft Azure WebJobs SDK, please see http://go.microsoft.com/fwlink/?LinkID=320976
    class Program
    {
        // Please set the following connection strings in app.config for this WebJob to run:
        // AzureWebJobsDashboard and AzureWebJobsStorage
        static void Main()
        {
            //set configuration of the host (http://azure.microsoft.com/en-us/documentation/articles/websites-dotnet-webjobs-sdk-storage-queues-how-to/#config)
            JobHostConfiguration config = new JobHostConfiguration();
            //limit of paralell executions (default is 16)
            config.Queues.BatchSize = 16;
            //limit of retries befor message goes to poisoned queue (default is 5)
            config.Queues.MaxDequeueCount = 3;
            //maximum time to check the queue again if it is empty. (default is 1 minute!)
            config.Queues.MaxPollingInterval = TimeSpan.FromSeconds(2);
            
            //start host with configuration
            var host = new JobHost(config);
            // The following code ensures that the WebJob will be running continuously
            host.RunAndBlock();
        }
    }
}
