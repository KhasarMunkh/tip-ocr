let ocrText = '';
let workers = [];

const imageInput = document.getElementById('imageInput');
const preview = document.getElementById('preview');
const progress = document.getElementById('progress');
const uploadSection = document.getElementById('uploadSection');
const tipInputSection = document.getElementById('tipInputSection');
const results = document.getElementById('results');
const rawTextDiv = document.getElementById('rawText');
const toggleRawBtn = document.getElementById('toggleRaw');

// Drag and drop functionality
uploadSection.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadSection.classList.add('dragover');
});

uploadSection.addEventListener('dragleave', () => {
    uploadSection.classList.remove('dragover');
});

uploadSection.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadSection.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleImage(files[0]);
    }
});

imageInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleImage(e.target.files[0]);
    }
});

function handleImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        preview.src = e.target.result;
        preview.style.display = 'block';
        performOCR(e.target.result);
    };
    reader.readAsDataURL(file);
}

async function performOCR(imageSrc) {
    progress.style.display = 'block';
    progress.textContent = 'Processing image... This may take a moment.';
    tipInputSection.style.display = 'none';
    results.style.display = 'none';

    try {
        const worker = await Tesseract.createWorker('eng');

        const { data: { text } } = await worker.recognize(imageSrc);
        await worker.terminate();

        ocrText = text;
        rawTextDiv.textContent = text;
        toggleRawBtn.style.display = 'inline-block';

        parseWorkerData(text);

        progress.textContent = `Found ${workers.length} workers! Enter total tips to calculate distribution.`;
        tipInputSection.style.display = 'block';

    } catch (error) {
        progress.textContent = 'Error processing image. Please try again.';
        console.error(error);
    }
}

function parseWorkerData(text) {
    workers = [];
    const lines = text.split('\n');

    // Pattern to match: Name, optional ID, then hours
    // Looking for patterns like "John Smith 1234 8.5" or "Jane Doe 10" or "Bob 7.25"
    // This pattern handles: Name (ID optional) Hours
    const workerPatternWithID = /([A-Za-z][\w\s]+?)\s+(\d{3,5})\s+(\d+\.?\d*)\s*$/;
    const workerPatternNoID = /([A-Za-z][\w\s]+?)\s+(\d+\.?\d*)\s*$/;

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        // Skip lines that are clearly totals or headers
        if (line.toLowerCase().includes('total') ||
            line.toLowerCase().includes('hours:') ||
            line.toLowerCase().includes('employee')) {
            continue;
        }

        // Try pattern with ID first
        let match = line.match(workerPatternWithID);
        if (match) {
            const name = match[1].trim();
            const hours = parseFloat(match[3]);

            if (hours > 0 && hours < 100 && name.length > 1) {
                workers.push({ name, hours });
            }
            continue;
        }

        // Try pattern without ID
        match = line.match(workerPatternNoID);
        if (match) {
            const name = match[1].trim();
            const hours = parseFloat(match[2]);

            if (hours > 0 && hours < 100 && name.length > 1) {
                workers.push({ name, hours });
            }
        }
    }

    // If we didn't find workers with the simple patterns, try a more aggressive approach
    if (workers.length === 0) {
        const alternatePattern = /([A-Za-z][\w\s]{2,})\s+(?:\d{3,5}\s+)?(\d+\.?\d*)/g;
        let match;
        while ((match = alternatePattern.exec(text)) !== null) {
            const name = match[1].trim();
            const hours = parseFloat(match[2]);
            if (hours > 0 && hours < 100 &&
                !name.toLowerCase().includes('total') &&
                !name.toLowerCase().includes('employee')) {
                workers.push({ name, hours });
            }
        }
    }
}

function calculateTips() {
    const totalTips = parseFloat(document.getElementById('totalTips').value);

    if (!totalTips || totalTips <= 0) {
        alert('Please enter a valid tip amount');
        return;
    }

    if (workers.length === 0) {
        alert('No workers found. Please try uploading the image again.');
        return;
    }

    const totalHours = workers.reduce((sum, worker) => sum + worker.hours, 0);
    const tipPerHour = totalTips / totalHours;

    let resultsHTML = '<h2 style="margin-bottom: 20px; color: #333;">Tip Distribution</h2>';

    workers.forEach(worker => {
        const tipAmount = worker.hours * tipPerHour;
        resultsHTML += `
            <div class="worker-card">
                <span class="worker-name">${worker.name}</span>
                <span class="worker-hours">${worker.hours} hours</span>
                <span class="worker-tip">$${tipAmount.toFixed(2)}</span>
            </div>
        `;
    });

    resultsHTML += `
        <div class="total-section">
            <h3>Total Hours: ${totalHours.toFixed(2)}</h3>
            <h3>Rate: $${tipPerHour.toFixed(2)} per hour</h3>
            <div class="total-amount">Total Tips: $${totalTips.toFixed(2)}</div>
        </div>
    `;

    results.innerHTML = resultsHTML;
    results.style.display = 'block';
}

function toggleRawText() {
    if (rawTextDiv.style.display === 'none' || rawTextDiv.style.display === '') {
        rawTextDiv.style.display = 'block';
        toggleRawBtn.textContent = 'Hide Raw OCR Text';
    } else {
        rawTextDiv.style.display = 'none';
        toggleRawBtn.textContent = 'Show Raw OCR Text';
    }
}
