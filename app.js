const opcua = require('node-opcua');
const mqtt = require('mqtt');
const config = require('./config.json');
const common = require('@bgroves/common');
var moment = require('moment');

//var datetime = require('node-datetime');
//https://github.com/node-opcua/node-opcua/blob/master/packages/node-opcua-client/source/opcua_client.ts
//const endpointUrl = config.OPCUA;
// 'opc.tcp://10.1.2.37:49321';
// 'opc.tcp://BUSCHE-ALB-KORS.BUSCHE-CNC.com:49321';
// 'opc.tcp://BUSCHE-ALB-KORS.BUSCHE-CNC.com:49320';
// 'opc.tcp://bgroves-desk:49320'; // very slow on home wifi
// 'opc.tcp://bgroves_desk.busche-cnc.com:49320';
// 'opc.tcp://192.168.254.15:49320';
// 'opc.tcp://10.1.1.193:49320';
// const endpointUrl = "opc.tcp://" + require("os").hostname() + ":48010";

var { MQTT_SERVER, OPCUA_ENDPOINT } = process.env;
// const MQTT_SERVER='localhost';
// const OPCUA_ENDPOINT='opc.tcp://10.1.2.37:49321';

async function main() {
  try {
    common.log('start of main');
    common.log(`MQTT_SERVER=${MQTT_SERVER}`);
    common.log(`OPCUA_ENDPOINT=${OPCUA_ENDPOINT}`);
    common.log(`MQTT_SERVER=${MQTT_SERVER}`);
    const mqttClient = mqtt.connect(`mqtt://${MQTT_SERVER}`);
    const client = opcua.OPCUAClient.create({
      endpoint_must_exist: false,
    });
    client.on('backoff', (retry, delay) =>
    common.log(
        'still trying to connect to ',
        OPCUA_ENDPOINT,
        ': retry =',
        retry,
        'next attempt in ',
        delay / 1000,
        'seconds',
      ),
    );

    await client.connect(OPCUA_ENDPOINT);
    const session = await client.createSession();

    const subscriptionOptions = {
      maxNotificationsPerPublish: 1000,
      publishingEnabled: true,
      requestedLifetimeCount: 100,
      requestedMaxKeepAliveCount: 10,
      requestedPublishingInterval: 1000,
    };

    const subscription = await session.createSubscription2(subscriptionOptions);
    subscription
      .on('started', () =>
      common.log(
          'subscription started - subscriptionId=',
          subscription.subscriptionId,
        ),
      )
      // .on('keepalive', () => log('keepalive'))
      .on('terminated', () => log('subscription terminated'));

    // http://node-opcua.github.io/api_doc/2.0.0/classes/clientsubscription.html#monitor
    var monitoredItem = [];
    for (let i = 0; i < config.NodeId.length; i++) {
      let mi = await subscription.monitor(
        {
          nodeId: config.NodeId[i].NodeId,
          attributeId: opcua.AttributeIds.Value,
          indexRange: null,
          dataEncoding: {namespaceIndex: 0, name: null},
        },
        {
          samplingInterval: 3000,
          filter: null,
          queueSize: 1,
          discardOldest: true,
        },
        opcua.TimestampsToReturn.Both, // These values are in GMT.
      );
      monitoredItem.push(mi);
      monitoredItem[i].on('changed', dataValue => {
       // var dt = datetime.create();
        // var transDate = dt.format('Y-m-d H:M:S');
        //var date = new Date();
        const transDate = moment(new Date()).format("YYYY-MM-DDTHH:mm:ss");
        common.log(`transDate=>${transDate}`);

        let cycle_Counter_Shift_SL = parseInt(dataValue.value.value.toString());
        let msg = {
          nodeId: config.NodeId[i].NodeId,
          plexus_Customer_No: config.NodeId[i].Plexus_Customer_No,
          pcn: config.NodeId[i].PCN,
          workcenter_Key: config.NodeId[i].Workcenter_Key,
          workcenter_Code: config.NodeId[i].Workcenter_Code,
          cnc: config.NodeId[i].CNC,
          cycle_Counter_Shift_SL: cycle_Counter_Shift_SL,
          transDate: transDate
        };

        let msgString = JSON.stringify(msg);
        common.log(msg);
        mqttClient.publish('Kep13319', msgString);
      });
    }
  } catch (err) {
    console.log('Error !!!', err);
  }
}

main();
