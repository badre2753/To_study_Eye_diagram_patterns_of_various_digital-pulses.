// State management
const state = {
    isRunning: false,
    pulseType: 'NRZ',
    bitRate: 1000,
    amplitude: 1.0,
    noiseLevel: 0,
    dataPattern: 'custom',
    customInput: '10101010',
    simulationSpeed: 500,
    waveformData: [],
    timeAxis: [],
    eyeData: [],
    eyeAnalysis: {
        eyeHeight: 0,
        eyeWidth: 0,
        jitter: 0,
        snr: 0
    }
};

// DOM elements
const elements = {
    pulseType: document.getElementById('pulseType'),
    dataPattern: document.getElementById('dataPattern'),
    customInput: document.getElementById('customInput'),
    patternBadge: document.getElementById('patternBadge'),
    bitRate: document.getElementById('bitRate'),
    bitRateValue: document.getElementById('bitRateValue'),
    amplitude: document.getElementById('amplitude'),
    amplitudeValue: document.getElementById('amplitudeValue'),
    noiseLevel: document.getElementById('noiseLevel'),
    noiseLevelValue: document.getElementById('noiseLevelValue'),
    simulationSpeed: document.getElementById('simulationSpeed'),
    simulationSpeedValue: document.getElementById('simulationSpeedValue'),
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),
    resetBtn: document.getElementById('resetBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    waveformCanvas: document.getElementById('waveformCanvas'),
    eyeDiagramCanvas: document.getElementById('eyeDiagramCanvas'),
    eyeHeight: document.getElementById('eyeHeight'),
    eyeWidth: document.getElementById('eyeWidth'),
    jitter: document.getElementById('jitter'),
    snr: document.getElementById('snr')
};

// Event listeners
elements.pulseType.addEventListener('change', () => {
    state.pulseType = elements.pulseType.value;
    updateWaveform();
});

elements.dataPattern.addEventListener('change', () => {
    state.dataPattern = elements.dataPattern.value;
    if (state.dataPattern !== 'custom') {
        elements.customInput.style.display = 'none';
        state.customInput = state.dataPattern;
        elements.patternBadge.textContent = state.dataPattern;
    } else {
        elements.customInput.style.display = 'block';
        elements.customInput.value = state.customInput;
        elements.patternBadge.textContent = state.customInput;
    }
    updateWaveform();
});

elements.customInput.addEventListener('input', () => {
    const validated = elements.customInput.value.replace(/[^01]/g, '').slice(0, 16) || '10101010';
    state.customInput = validated;
    elements.customInput.value = validated;
    elements.patternBadge.textContent = validated;
    updateWaveform();
});

elements.bitRate.addEventListener('input', () => {
    state.bitRate = parseInt(elements.bitRate.value);
    elements.bitRateValue.textContent = `${state.bitRate} bps`;
    updateWaveform();
});

elements.amplitude.addEventListener('input', () => {
    state.amplitude = parseFloat(elements.amplitude.value);
    elements.amplitudeValue.textContent = `${state.amplitude.toFixed(1)}V`;
    updateWaveform();
});

elements.noiseLevel.addEventListener('input', () => {
    state.noiseLevel = parseInt(elements.noiseLevel.value);
    elements.noiseLevelValue.textContent = `${state.noiseLevel}%`;
    updateWaveform();
});

elements.simulationSpeed.addEventListener('input', () => {
    state.simulationSpeed = parseInt(elements.simulationSpeed.value);
    elements.simulationSpeedValue.textContent = `${state.simulationSpeed}ms`;
    if (state.isRunning) {
        clearInterval(simulationInterval);
        simulationInterval = setInterval(updateWaveform, state.simulationSpeed);
    }
});

elements.startBtn.addEventListener('click', startSimulation);
elements.stopBtn.addEventListener('click', stopSimulation);
elements.resetBtn.addEventListener('click', resetSimulation);
elements.downloadBtn.addEventListener('click', downloadData);

// Initialize
let simulationInterval = null;
initCanvas();
updateWaveform();

// Functions
function getCurrentPattern() {
    return state.dataPattern === 'custom' ? state.customInput : state.dataPattern;
}

function generateWaveform() {
    const pattern = getCurrentPattern();
    const sampleRate = 100000;
    const duration = 0.016; // 16ms
    const samplesPerBit = sampleRate / state.bitRate;
    const totalSamples = Math.floor(sampleRate * duration);
    
    const waveform = [];
    const timeAxis = [];
    
    for (let i = 0; i < totalSamples; i++) {
        const t = i / sampleRate;
        timeAxis.push(t);
        
        const bitIndex = Math.floor(t * state.bitRate) % pattern.length;
        const bit = pattern[bitIndex] === '1' ? 1 : -1;
        
        let sample = 0;
        
        switch (state.pulseType) {
            case 'NRZ':
                sample = bit * state.amplitude;
                break;
            case 'RZ':
                const positionInBit = (t * state.bitRate) % 1;
                sample = (positionInBit < 0.5) ? bit * state.amplitude : 0;
                break;
            case 'Manchester':
                const manPosition = (t * state.bitRate) % 1;
                sample = (manPosition < 0.5) ? bit * state.amplitude : -bit * state.amplitude;
                break;
            case 'AMI':
                const amiPosition = (t * state.bitRate) % 1;
                if (bit === 1) {
                    const oneCount = Math.floor(t * state.bitRate / pattern.length);
                    const polarity = oneCount % 2 === 0 ? 1 : -1;
                    sample = polarity * state.amplitude;
                } else {
                    sample = 0;
                }
                break;
        }
        
        if (state.noiseLevel > 0) {
            const noise = (Math.random() - 0.5) * 2 * state.noiseLevel / 100 * state.amplitude;
            sample += noise;
        }
        
        waveform.push(sample);
    }
    
    return { waveform, timeAxis };
}

function generateEyeDiagram(waveform, bitRate, sampleRate) {
    const samplesPerBit = sampleRate / bitRate;
    const eyeTraces = [];
    const traceLength = Math.floor(samplesPerBit * 2);
    
    for (let i = 0; i < waveform.length - traceLength; i += Math.floor(samplesPerBit / 4)) {
        eyeTraces.push(waveform.slice(i, i + traceLength));
    }
    
    return eyeTraces;
}

function analyzeEyeDiagram(eyeTraces) {
    if (eyeTraces.length === 0) return { eyeHeight: 0, eyeWidth: 0, jitter: 0, snr: 0 };
    
    const traceLength = eyeTraces[0].length;
    const midPoint = Math.floor(traceLength / 2);
    
    // Eye height calculation
    let minHigh = Infinity;
    let maxLow = -Infinity;
    
    for (let i = 0; i < eyeTraces.length; i++) {
        const midValue = eyeTraces[i][midPoint];
        if (midValue > 0) {
            if (midValue < minHigh) minHigh = midValue;
        } else {
            if (midValue > maxLow) maxLow = midValue;
        }
    }
    
    const eyeHeight = minHigh - maxLow;
    
    // Eye width calculation
    const threshold = state.amplitude * 0.5;
    let leftEdge = 0;
    let rightEdge = traceLength - 1;
    
    for (let i = 0; i < midPoint; i++) {
        let allCrossing = true;
        for (let j = 0; j < eyeTraces.length; j++) {
            if (Math.abs(eyeTraces[j][i]) > threshold) {
                allCrossing = false;
                break;
            }
        }
        if (allCrossing) {
            leftEdge = i;
            break;
        }
    }
    
    for (let i = traceLength - 1; i > midPoint; i--) {
        let allCrossing = true;
        for (let j = 0; j < eyeTraces.length; j++) {
            if (Math.abs(eyeTraces[j][i]) > threshold) {
                allCrossing = false;
                break;
            }
        }
        if (allCrossing) {
            rightEdge = i;
            break;
        }
    }
    
    const eyeWidth = rightEdge - leftEdge;
    
    // Jitter calculation
    const zeroCrossings = [];
    for (let i = 0; i < eyeTraces.length; i++) {
        for (let j = 1; j < traceLength; j++) {
            if (eyeTraces[i][j-1] * eyeTraces[i][j] < 0) {
                zeroCrossings.push(j);
                break;
            }
        }
    }
    
    let jitter = 0;
    if (zeroCrossings.length > 1) {
        const mean = zeroCrossings.reduce((a, b) => a + b, 0) / zeroCrossings.length;
        const variance = zeroCrossings.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / zeroCrossings.length;
        jitter = Math.sqrt(variance);
    }
    
    // SNR calculation
    const signalPower = Math.pow(state.amplitude, 2);
    const noisePower = Math.pow(state.noiseLevel / 100 * state.amplitude, 2) / 3;
    const snr = 10 * Math.log10(signalPower / noisePower);
    
    return {
        eyeHeight: isFinite(eyeHeight) ? eyeHeight : 0,
        eyeWidth: isFinite(eyeWidth) ? eyeWidth : 0,
        jitter: isFinite(jitter) ? jitter : 0,
        snr: isFinite(snr) ? snr : 0
    };
}

function updateWaveform() {
    const { waveform, timeAxis } = generateWaveform();
    state.waveformData = waveform;
    state.timeAxis = timeAxis;
    
    const eyeTraces = generateEyeDiagram(waveform, state.bitRate, 100000);
    state.eyeData = eyeTraces;
    
    state.eyeAnalysis = analyzeEyeDiagram(eyeTraces);
    
    drawWaveform();
    drawEyeDiagram();
    updateMetrics();
}

function initCanvas() {
    const waveformCtx = elements.waveformCanvas.getContext('2d');
    const eyeCtx = elements.eyeDiagramCanvas.getContext('2d');
    
    const rect = elements.waveformCanvas.parentElement.getBoundingClientRect();
    elements.waveformCanvas.width = rect.width * 2;
    elements.waveformCanvas.height = rect.height * 2;
    waveformCtx.scale(2, 2);
    
    const eyeRect = elements.eyeDiagramCanvas.parentElement.getBoundingClientRect();
    elements.eyeDiagramCanvas.width = eyeRect.width * 2;
    elements.eyeDiagramCanvas.height = eyeRect.height * 2;
    eyeCtx.scale(2, 2);
}

function drawWaveform() {
    const canvas = elements.waveformCanvas;
    const ctx = canvas.getContext('2d');
    const width = canvas.width / 2;
    const height = canvas.height / 2;
    
    ctx.clearRect(0, 0, width, height);
    
    const margin = { top: 20, right: 20, bottom: 40, left: 60 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    
    const minValue = state.waveformData.length > 0 ? Math.min(...state.waveformData) : -state.amplitude;
    const maxValue = state.waveformData.length > 0 ? Math.max(...state.waveformData) : state.amplitude;
    const valueRange = maxValue - minValue || 2 * state.amplitude;
    
    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i <= 10; i++) {
        const x = margin.left + (i * plotWidth) / 10;
        ctx.beginPath();
        ctx.moveTo(x, margin.top);
        ctx.lineTo(x, margin.top + plotHeight);
        ctx.stroke();
    }
    
    for (let i = 0; i <= 8; i++) {
        const y = margin.top + (i * plotHeight) / 8;
        ctx.beginPath();
        ctx.moveTo(margin.left, y);
        ctx.lineTo(margin.left + plotWidth, y);
        ctx.stroke();
    }
    
    // Draw axes
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + plotHeight);
    ctx.lineTo(margin.left + plotWidth, margin.top + plotHeight);
    ctx.stroke();
    
    // Draw waveform
    if (state.waveformData.length > 1) {
        ctx.strokeStyle = state.isRunning ? '#2ecc71' : '#3498db';
        ctx.lineWidth = state.isRunning ? 3 : 2;
        ctx.beginPath();
        
        for (let i = 0; i < state.waveformData.length; i++) {
            const x = margin.left + (i * plotWidth) / (state.waveformData.length - 1);
            const y = margin.top + plotHeight - ((state.waveformData[i] - minValue) * plotHeight) / valueRange;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        
        if (state.isRunning) {
            ctx.shadowColor = '#2ecc71';
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }
    
    // Draw bit boundaries and labels
    const pattern = getCurrentPattern();
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    
    for (let i = 1; i < pattern.length; i++) {
        const x = margin.left + (i * plotWidth) / pattern.length;
        ctx.beginPath();
        ctx.moveTo(x, margin.top);
        ctx.lineTo(x, margin.top + plotHeight);
        ctx.stroke();
    }
    ctx.setLineDash([]);
    
    // Draw data pattern labels
    ctx.fillStyle = '#374151';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    
    for (let i = 0; i < pattern.length; i++) {
        const x = margin.left + ((i + 0.5) * plotWidth) / pattern.length;
        const y = height - 10;
        
        if (state.isRunning) {
            const currentTime = Date.now();
            const currentBit = Math.floor((currentTime / 200) % pattern.length);
            if (i === currentBit) {
                ctx.fillStyle = '#2ecc71';
                ctx.font = 'bold 16px monospace';
            } else {
                ctx.fillStyle = '#7f8c8d';
                ctx.font = '14px monospace';
            }
        }
        
        ctx.fillText(pattern[i], x, y);
    }
    
    // Draw labels
    ctx.fillStyle = '#374151';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Time (s)', width / 2, height - 5);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Amplitude (V)', 0, 0);
    ctx.restore();
    
    // Draw title
    ctx.font = 'bold 14px sans-serif';
    const title = `${state.pulseType} Pulse Waveform${state.isRunning ? ' (LIVE)' : ''}`;
    ctx.fillStyle = state.isRunning ? '#2ecc71' : '#374151';
    ctx.fillText(title, width / 2, 15);
}

function drawEyeDiagram() {
    const canvas = elements.eyeDiagramCanvas;
    const ctx = canvas.getContext('2d');
    const width = canvas.width / 2;
    const height = canvas.height / 2;
    
    ctx.clearRect(0, 0, width, height);
    
    const margin = { top: 20, right: 20, bottom: 60, left: 60 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    
    const allValues = state.eyeData.flat();
    const minValue = allValues.length > 0 ? Math.min(...allValues) : -state.amplitude;
    const maxValue = allValues.length > 0 ? Math.max(...allValues) : state.amplitude;
    const valueRange = maxValue - minValue || 2 * state.amplitude;
    
    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i <= 10; i++) {
        const x = margin.left + (i * plotWidth) / 10;
        ctx.beginPath();
        ctx.moveTo(x, margin.top);
        ctx.lineTo(x, margin.top + plotHeight);
        ctx.stroke();
    }
    
    for (let i = 0; i <= 8; i++) {
        const y = margin.top + (i * plotHeight) / 8;
        ctx.beginPath();
        ctx.moveTo(margin.left, y);
        ctx.lineTo(margin.left + plotWidth, y);
        ctx.stroke();
    }
    
    // Draw axes
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + plotHeight);
    ctx.lineTo(margin.left + plotWidth, margin.top + plotHeight);
    ctx.stroke();
    
    // Draw eye diagram traces
    const alpha = Math.min(0.6, 1.0 / Math.sqrt(state.eyeData.length));
    
    state.eyeData.forEach(trace => {
        if (trace.length === 0) return;
        
        ctx.strokeStyle = `rgba(52, 152, 219, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        for (let i = 0; i < trace.length; i++) {
            const x = margin.left + (i * plotWidth) / (trace.length - 1);
            const y = margin.top + plotHeight - ((trace[i] - minValue) * plotHeight) / valueRange;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    });
    
    // Draw title
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`Eye Diagram - ${state.pulseType} @ ${state.bitRate} bps`, width / 2, 15);
}

function updateMetrics() {
    elements.eyeHeight.textContent = state.eyeAnalysis.eyeHeight.toFixed(3) + 'V';
    elements.eyeWidth.textContent = state.eyeAnalysis.eyeWidth;
    elements.jitter.textContent = state.eyeAnalysis.jitter.toFixed(3);
    elements.snr.textContent = state.eyeAnalysis.snr.toFixed(2);
}

function startSimulation() {
    state.isRunning = true;
    elements.startBtn.disabled = true;
    elements.stopBtn.disabled = false;
    simulationInterval = setInterval(updateWaveform, state.simulationSpeed);
    updateWaveform();
}

function stopSimulation() {
    state.isRunning = false;
    elements.startBtn.disabled = false;
    elements.stopBtn.disabled = true;
    clearInterval(simulationInterval);
    updateWaveform();
}

function resetSimulation() {
    stopSimulation();
    state.waveformData = [];
    state.timeAxis = [];
    state.eyeData = [];
    state.eyeAnalysis = { eyeHeight: 0, eyeWidth: 0, jitter: 0, snr: 0 };
    updateMetrics();
    drawWaveform();
    drawEyeDiagram();
}

function downloadData() {
    if (state.timeAxis.length === 0) return;
    
    const csvContent = state.timeAxis.map((t, i) => `${t},${state.waveformData[i]}`).join('\n');
    const blob = new Blob([`Time,Amplitude\n${csvContent}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eye_diagram_${state.pulseType}_${state.bitRate}bps.csv`;
    a.click();
    URL.revokeObjectURL(url);
}