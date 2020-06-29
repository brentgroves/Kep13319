const opcua = require('node-opcua');
const mqtt = require('mqtt');
const config = require('../Config13319/config.json');
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
    for (let i = 0; i < config.nodes.length; i++) {
      let mi = await subscription.monitor(
        {
          nodeId: config.nodes[i].nodeId,
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
      common.log(`kep13319 => monitoring ${config.nodes[i].nodeId}`);
      monitoredItem[i].on('changed', dataValue => {
       // var dt = datetime.create();
        // var transDate = dt.format('Y-m-d H:M:S');
        //var date = new Date();
        const transDate = moment(new Date()).format("YYYY-MM-DDTHH:mm:ss");
        common.log(`transDate=>${transDate}`);

        let value = parseInt(dataValue.value.value.toString());
        let msg = {
          updateId: config.nodes[i].updateId,
          nodeId: config.nodes[i].nodeId,
          name: config.nodes[i].name,
          plexus_Customer_No: config.nodes[i].plexus_Customer_No,
          pcn: config.nodes[i].pcn,
          workcenter_Key: config.nodes[i].workcenter_Key,
          workcenter_Code: config.nodes[i].workcenter_Code,
          cnc: config.nodes[i].cnc,
          value: value,
          transDate: transDate
        };

        let msgString = JSON.stringify(msg);
        common.log(`Kep13319 publish => ${msgString}`);
        mqttClient.publish('Kep13319', msgString);
      });
    }
  } catch (err) {
    console.log('Error !!!', err);
  }
}

main();
