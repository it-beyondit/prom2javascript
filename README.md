# prom2javascript

A library to convert Prometheus metrics from text to JavaScript.

## Usage

Install:
```
npm i prom2javascript
```

Example:
```
import { getMetricsFromStream } from 'prom2javascript';

const metrics = await getMetricsFromStream(fs.createReadStream('metrics.txt'));
```

More examples in the `test/unit` directory.

## License

MIT.
