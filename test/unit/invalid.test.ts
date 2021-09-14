import { Readable } from 'stream';
import { getMetricsFromStream } from '../../src/prom'

it('attempts to parse a histogram without a +Inf bucket', () => {
    const input = Readable.from([`
# TYPE foo histogram
foo_bucket{le="0.5"} 0
foo_bucket{le="1"} 1
foo_sum 0
foo_count 3
    `]);

    return getMetricsFromStream(input).then(metrics => {
        expect(true).toEqual(false);
    }, error => {
        expect(error).not.toBeFalsy();
    });
});

it('attempts to parse a histogram where the +Inf bucket does not match with count', () => {
    const input = Readable.from([`
# TYPE foo histogram
foo_bucket{le="0.5"} 0
foo_bucket{le="+Inf"} 2
foo_sum 0
foo_count 3
    `]);

    return getMetricsFromStream(input).then(metrics => {
        expect(true).toEqual(false);
    }, error => {
        expect(error).not.toBeFalsy();
    });
});

it('attempts to parse a counter with no value', () => {
    const input = Readable.from([`
# TYPE foo counter
foo
    `]);

    return getMetricsFromStream(input).then(metrics => {
        expect(true).toEqual(false);
    }, error => {
        expect(error).not.toBeFalsy();
    });
});
