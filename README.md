# prom2javascript

A library to convert Prometheus metrics from text to JavaScript.

## Usage

Install:
```
npm i prom2javascript
```

Example with stream:
```
import { getMetricsFromStream } from 'prom2javascript';

const metrics = await getMetricsFromStream(fs.createReadStream('metrics.txt'));
```

Example with iterator:
```
import { getMetricsFromIterator } from 'prom2javascript';

const input = function* () {
    yield 'foo 3.14';
}

const metrics = await getMetricsFromIterator(input());
```

More examples in the `test/unit` directory.

## License

MIT.
