/*
 * Copyright (C) 2021 BeyondIt S.r.l.
 *
 * Licensed under the MIT License, see LICENSE file.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import readline from 'readline';
import stream from 'stream';

export type PromLabels = Record<string, string>;

export type PromData = {
    labels: PromLabels,
    value: number,
    timestamp?: number
}

export interface PromHistogramData {
    labels: PromLabels,
    buckets: Record<string, number>;
    sum?: number;
    count: number;
}

export interface PromSummaryData {
    labels: PromLabels,
    quantiles: Record<string, number>;
    sum?: number;
    count?: number;
}

export type PromMetricData = PromData[] | PromHistogramData[] | PromSummaryData[];

export interface PromMetric {
    type: string;
    help: string;
    data: PromMetricData;
}

export type PromMetrics = Record<string, PromMetric>;

type PromDatapoint = {
    name: string;
    data: PromData;
}

interface PromRawMetric {
    type: string;
    help?: string;
    data: PromDatapoint[];
}

type PromRawMetrics = Record<string, PromRawMetric>;

const LabelQuantile = 'quantile';
const LabelLessOrEqual = 'le';

const SuffixBucket = '_bucket';
const SuffixCount = '_count';
const SuffixSum = '_sum';

const TypeCounter = 'counter';
const TypeGauge = 'gauge';
const TypeHistogram = 'histogram';
const TypeSummary = 'summary';
const TypeUnknown = 'unknown';

const PromLabelRegExp = /^\s*(\w+)="(.*?)"\s*,?/;

// Cheat alert: to simplify parsing, we replace the \" sequence with an unused single character
const EscapeCharCodePoint = 1;
const DoubleQuoteToEscape = String.fromCodePoint(EscapeCharCodePoint);
const EscapeToDoubleQuote = new RegExp(DoubleQuoteToEscape, 'g');

function parseMetricLabels(text: string): Record<string,string> {
    const labels: Record<string,string> = {};
    
    const origText = text;

    if(text) {
        text = text.replace(/\\"/g, DoubleQuoteToEscape);
    }

    while(text) {
        const match = text.match(PromLabelRegExp);

        if(!match) {
            break;
        }

        const key = match[1];
        const value = match[2];
        
        labels[key] = value.replace(EscapeToDoubleQuote, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n');

        text = text.substring(match[0].length);
    }

    if(text) {
        throw new Error(`Cannot parse Prometheus label {${origText}}`);
    }

    return labels;
}

/*
    This regular expression splits a metric in 4 groups (index 1 to 4):
    - name
    - comma separated labels, which need to be parsed separately, may be undefined
    - value
    - timestamp, may be undefined
*/
const PromMetricDataRegExp = /^(\w+)(?:\{\s*(.*?)\s*\})?\s+(\+Inf|[-]?\d+(?:\.\d+)?(?:[eE][+-]?\d*)?)(?:\s+([-]?\d+))?\s*$/;

function parseMetricDatapoint(line: string): PromDatapoint {
    const match = line.match(PromMetricDataRegExp);

    if(match) {
        const result: PromDatapoint = {
            name: match[1],
            data: {
                labels: parseMetricLabels(match[2]),
                value: match[3] == '+Inf' ? +Infinity : parseFloat(match[3])
            }
        }

        if(match[4]) {
            result.data.timestamp = parseInt(match[4], 10);
        }

        return result;
    }

    throw new Error(`Unable to parse metric [${line}]`);
}

/*
    This regular expression splits a metric metadata in 3 groups (index 1 to 3):
    - metadata, e.g. TYPE or HELP
    - metric name
    - metric type or description depending on metadata
*/
const PromMetricMetaRegExp = /^#\s+(\w+)\s+(\w+)(?:\s+(.*))?\s*$/;

function getRawMetric(metrics: PromRawMetrics, name: string): PromRawMetric {
    if(!metrics[name]) {
        metrics[name] = {
            type: TypeUnknown,
            data: []
        }
    }

    return metrics[name];
}

function addMetricLine(metrics: PromRawMetrics, line: string): void {
    // Check if line is metadata
    const match = line.match(PromMetricMetaRegExp);

    if(match) {
        // Metadata
        const meta = match[1];
        const name = match[2];
        const data = match[3];

        switch(meta) {
        case 'TYPE':
            getRawMetric(metrics, name).type = data;
            break;
        case 'HELP':
            getRawMetric(metrics, name).help = data;
            break;
        }
    }
    else {
        line = line.trim();

        if(line && line[0] != '#') {
            // Datapoint
            const datapoint = parseMetricDatapoint(line);
            
            let name = datapoint.name;
            
            let metric = metrics[name];

            if(!metric) {
                const isBucket = name.endsWith(SuffixBucket);
                const isCount = name.endsWith(SuffixCount);
                const isSum = name.endsWith(SuffixSum);

                if(isBucket || isCount || isSum) {
                    name = name.substring(0, name.lastIndexOf('_'));
                    metric = metrics[name];
                }
            }

            if(!metric) {
                metric = getRawMetric(metrics, datapoint.name);
            }

            metric.data.push(datapoint);
        }
    }
}

function makeLabelsIndex(labels: PromLabels): string {
    const keys = Object.keys(labels).sort();

    return keys.map(key => `${key}=${labels[key]}`).join('/');
}

function getCounterMetricData(metric: PromRawMetric): PromData[] {
    return metric.data.map(item => item.data);
}

function getHistogramMetricData(metric: PromRawMetric): PromHistogramData[] {
    const histograms: Record<string, PromHistogramData> = {};

    metric.data.forEach(datapoint => {
        const labels = datapoint.data.labels;

        const bucketId = labels[LabelLessOrEqual];

        delete labels[LabelLessOrEqual]; // Invalidates the raw metric, but it's ok because we're going to discard it anyway

        const index = makeLabelsIndex(labels);

        if(!histograms[index]) {
            histograms[index] = {
                labels,
                buckets: {},
                count: 0
            }
        }

        const histogram = histograms[index];

        const name = datapoint.name;

        if(name.endsWith(SuffixBucket)) {
            histogram.buckets[bucketId] = datapoint.data.value;
        }
        else if(name.endsWith(SuffixCount)) {
            histogram.count = datapoint.data.value;
        }
        else if(name.endsWith(SuffixSum)) {
            histogram.sum = datapoint.data.value;
        }
    });

    Object.keys(histograms).forEach(key => {
        const histogram = histograms[key];

        if(histogram.count != histogram.buckets['+Inf'] || histogram.buckets['+Inf'] == null) {
            throw new Error(`Malformed histogram (bucket[+Inf]=${histogram.buckets['+Inf']}, count=${histogram.count}, labels=[${makeLabelsIndex(histogram.labels)}])`);
        }
    });

    return Object.keys(histograms).map(key => histograms[key]);
}

function getSummaryMetricData(metric: PromRawMetric): PromSummaryData[] {
    const summaries: Record<string, PromSummaryData> = {};

    metric.data.forEach(datapoint => {
        const labels = datapoint.data.labels;

        const quantileId = labels[LabelQuantile];

        delete labels[LabelQuantile]; // Invalidates the raw metric, but it's ok because we're going to discard it anyway

        const index = makeLabelsIndex(labels);

        if(!summaries[index]) {
            summaries[index] = {
                labels,
                quantiles: {}
            }
        }

        const summary = summaries[index];

        const name = datapoint.name;

        if(name.endsWith(SuffixCount)) {
            summary.count = datapoint.data.value;
        }
        else if(name.endsWith(SuffixSum)) {
            summary.sum = datapoint.data.value;
        }
        else {
            summary.quantiles[quantileId] = datapoint.data.value;
        }
    });

    return Object.keys(summaries).map(key => summaries[key]);
}

function getMetric(metric: PromRawMetric): PromMetric {
    let data: PromMetricData;

    switch(metric.type) {
    case TypeHistogram:
        data = getHistogramMetricData(metric);
        break;
    case TypeSummary:
        data = getSummaryMetricData(metric);
        break;
    default:
        data = getCounterMetricData(metric);
        break;
    }

    return {
        type: metric.type,
        help: metric.help || '',
        data
    }
}

export async function getMetricsFromStream(input: stream.Readable): Promise<PromMetrics> {
    return new Promise<PromMetrics>((resolve, reject) => {
        const rawMetrics: PromRawMetrics = {};
        let error: unknown;

        const rl = readline.createInterface({
          input,
          terminal: false
        });
        
        rl.on('close', () => {
            if(error) {
                reject(error);
            }
            else {
                try {
                    const metrics: PromMetrics = {}
        
                    Object.keys(rawMetrics).forEach(key => metrics[key] = getMetric(rawMetrics[key]));

                    resolve(metrics);
                }
                catch(ex) {
                    reject(ex);
                }
            }
        });

        rl.on('line', line => {
            try {
                addMetricLine(rawMetrics, line);
            }
            catch(ex) {
                error = ex;

                rl.close();
            }
        });
    });
}

export async function getMetricsFromIterator(input: Iterator<string>): Promise<PromMetrics> {
    return new Promise<PromMetrics>((resolve, reject) => {
        try {
            const rawMetrics: PromRawMetrics = {};

            let item = input.next();

            while(!item.done) {
                addMetricLine(rawMetrics, item.value);

                item = input.next();
            }
                
            const metrics: PromMetrics = {}
        
            Object.keys(rawMetrics).forEach(key => metrics[key] = getMetric(rawMetrics[key]));

            resolve(metrics);
        }
        catch(error) {
            reject(error);
        }
    });
}
