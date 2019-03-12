

/* 
<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
	<methodName>selve.GW.command.device</methodName>
	<array>
		<int>1</int>
		<int>2</int>
		<int>1</int>
		<int>0</int>
	</array>
</methodCall>

*/


const SerialPort = require('serialport');
const parser = require('fast-xml-parser');

const path = '/dev/tty.usbserial-DM00BGGT';
const Readline = SerialPort.parsers.Readline;

// 1 = Arbeitszimmer, Schlafzimmer, Zockerzimmer, Wohnzimmer, Küche
const channel = 1;
const dir = 0; // 0 stop, 1 up, 2 down

const cb = function(err) {
    const result = port.write(`<methodCall><methodName>selve.GW.command.device</methodName><array><int>${channel}</int><int>${dir}</int><int>1</int><int>0</int></array></methodCall>`);
    console.log(result);
};

const port = new SerialPort(path, {
    baudRate: 115200
}, cb);

const parser = port.pipe(new Readline());
parser.on('data', function(data) {
    console.log(data);
});
parser.on('end', console.log);

setInterval(() => {
    console.log('live');
}, 1000*60*60);
