"use strict";

var heimdallrClient = require('heimdallr-client'),
    tokens = {
        consumer: <consumerToken>,
        provider: <providerToken>
    },
    uuids = {
        consumer: <consumerUUID>,
        provider: <providerUUID>
    },
    controlHandler,
    provider,
    consumer;

// Callbacks for the different control packet subtypes
controlHandler = {
    turnLeft: function () {
        // It's a NASCAR thing
        provider.sendEvent('status', 'turned left');
    },
    turnRight: function () {
        // It's a Zoolander thing
        provider.sendEvent('status', 'turned right');
    },
    accelerate: function (packet) {
        var accelerometerReading = {x: 0, y: 0, z: 0};

        // If we accelerated, we've got power; if we decelerated, we've lost it
        provider.sendEvent('power', packet.data.magnitude > 0);

        // Our control system has a very good response
        accelerometerReading[packet.data.direction] = packet.data.magnitude;
        provider.sendSensor('accelerometer', accelerometerReading);
    }
};

// Make a new provider
provider = new heimdallrClient.Provider(tokens.provider);
provider.on('control', function (packet) {
    controlHandler[packet.subtype](packet);
    if (packet.persistent) {
        // Let the Heimdallr server know the control has been completed
        provider.completed(packet.persistent);
        console.log('PROVIDER: completed persistent control');
    }
});
provider.connect();

// Make a fake temperature every second and send the measured value to the Heimdallr server
(function readTemperature() {
    console.log('PROVIDER: sending temperature');
    provider.sendSensor('temperature', Math.random() * 40 + 50);
    setTimeout(readTemperature, 1000);
}());

// Make a new consumer
consumer = new heimdallrClient.Consumer(tokens.consumer);
consumer.on('auth-success', function () {
    // We've successfully authenticated with the Heimdallr server.
    // Now we can subscribe to providers we want to interact with.
    consumer.subscribe(uuids.provider);
}).on('event', function (packet) {
    // packet.provider tells us who sent the sensor packet.
    if (packet.subtype === 'status') {
        console.log('RECVD status:', packet.data);
    } else if (packet.subtype === 'power') {
        console.log('RECVD ' + packet.data ? 'full power' : 'no power');
    }
}).on('sensor', function (packet) {
    // packet.provider tells us who sent the sensor packet.
    console.log('RECVD %s:', packet.subtype, packet.data);
});
consumer.connect();

consumer.sendControl(uuids.provider, 'accelerate', {direction: 'x', magnitude: 10});
consumer.sendControl(uuids.provider, 'turnRight', null);
consumer.sendControl(uuids.provider, 'turnLeft', null);
consumer.sendControl(uuids.provider, 'accelerate', {direction: 'x', magnitude: 0});

setTimeout(function () {
    console.log('GETTING STATE');
    consumer.getState(uuids.provider, ['status', 'power']);
}, 2 * 1000);

setTimeout(function () {
    // Sends a persistent control
    consumer.sendControl(uuids.provider, 'turnRight', null, true);
}, 3 * 1000);