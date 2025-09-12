// ==================================================================
// ===== 전역 변수 선언 =====
// ==================================================================

// --- 데이터 변수 (앱 전역에서 사용) ---
let probDf = null;
let lottoData = {}; // 동적으로 생성될 객체
let firstPlaceNumbers = new Set();
let lottoHistory = [];

// --- 앱 상태 변수 ---
const WORKER_URL = 'https://lotto-community-api.resong84.workers.dev'; 
let selectedGame = 'A';
let selectedNums = {A:[], B:[]};
let isWinFound = false;
let autoGenerateInterval = null;
let autoGenerateCount = 0;
let selectedProbNums = [];

// --- 커뮤니티 페이지 변수 ---
let allPosts = [];
let currentPage = 1;
const postsPerPage = 5;


// ==================================================================
// ===== 앱 초기화 및 이벤트 리스너 =====
// ==================================================================

document.addEventListener('DOMContentLoaded', () => {
    const generateButton = document.getElementById('generate-button');
    
    // --- 랜딩 페이지 및 시작 버튼 로직 ---
    const landingPage = document.getElementById('landing-page');
    const mainApp = document.getElementById('main-app');
    const startButton = document.getElementById('start-button');

    startButton.addEventListener('click', () => {
        landingPage.style.display = 'none';
        mainApp.style.display = 'block';
    });
    // --- 랜딩 페이지 로직 끝 ---

    // --- Data Loading and Parsing ---
    async function loadData() {
        try {
            const response = await fetch('lotto_data.txt');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const dataText = await response.text();
            
            // 1. 번호 생성 로직을 위한 데이터 구조 생성 (probDf)
            probDf = parseAndPrepareData(dataText);
            
            // 2. 확률 조회 로직을 위한 데이터 구조 생성 (lottoData)
            lottoData = createLottoDataObject(probDf);

            // 데이터 로드 완료 후 버튼 활성화
            document.getElementById('generate-button').disabled = false;
            document.getElementById('viewProbBtn').disabled = false;

        } catch (e) {
            alert(`'lotto_data.txt' 파일을 불러오는 데 실패했습니다: ${e.message}`);
        }
    }
    
    async function loadFirstPlaceData() {
        firstPlaceNumbers = new Set(); 
        try {
            const response = await fetch('lotto_data_1st_number.txt');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const dataText = await response.text();
            const lines = dataText.trim().split('\n');

            lines.forEach((line, index) => {
                if (index === 0 || line.trim() === '') {
                    return;
                }
                const parts = line.split('\t');
                if (parts.length < 8) {
                    return; 
                }
                const winningNumbers = parts.slice(1, 7);
                const combinationString = winningNumbers
                                              .map(num => parseInt(num.trim()))
                                              .sort((a, b) => a - b)
                                              .join(',');
                
                firstPlaceNumbers.add(combinationString);
            });
        } catch (e) {
            console.warn(`'lotto_data_1st_number.txt' 파일을 불러오는 데 실패했습니다: ${e.message}. '1등 번호 제외' 기능이 작동하지 않을 수 있습니다.`);
        }
    }
    
    async function loadLottoHistory() {
        try {
            const response = await fetch('lottoHistory.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            lottoHistory = await response.json();
        } catch (e) {
            console.error("'lottoHistory.json' 파일을 불러오는 데 실패했습니다:", e);
            alert('과거 당첨 내역 데이터를 불러오는 데 실패했습니다. 통계 조회 기능이 작동하지 않을 수 있습니다.');
        }
    }

    // 초기 데이터 로드
    loadData();
    loadFirstPlaceData();
    loadLottoHistory();

    // --- UI 렌더링 및 탭 초기화 ---
    renderLottoPaper();
    renderProbPaper();
    showTab(1);

    // --- 이벤트 리스너 바인딩 ---
    generateButton.addEventListener('click', generateCombinations);
    
    const rankSlider = document.getElementById('rank-slider');
    rankSlider.addEventListener('input', () => {
        updateSliderTrack();
        checkLottoStats();
    });
    
    const autoGenerateCheckbox = document.getElementById('auto-generate-checkbox');
    const pauseCheckbox = document.getElementById('pause-on-win-checkbox');

    autoGenerateCheckbox.addEventListener('change', () => {
        if (autoGenerateCheckbox.checked) {
            pauseCheckbox.checked = false;
            pauseCheckbox.disabled = true;
        } else {
            pauseCheckbox.disabled = false;
        }
    });

    updateSliderTrack();

    const communityText = document.getElementById('community-text');
    const charCounter = document.getElementById('char-counter');
    const postButton = document.getElementById('post-button');
    const imageUpload1 = document.getElementById('image-upload1');
    const imageUpload2 = document.getElementById('image-upload2');
    const nicknameInput = document.getElementById('nickname-input');

    communityText.addEventListener('input', () => {
        const currentLength = communityText.value.length;
        charCounter.textContent = `${currentLength} / 20`;
    });
    
    imageUpload1.addEventListener('change', () => updateImageName('image-upload1', 'image-name1'));
    imageUpload2.addEventListener('change', () => updateImageName('image-upload2', 'image-name2'));

    postButton.addEventListener('click', createPost);

    const savedNickname = localStorage.getItem('lottoAppNickname');
    if (savedNickname) {
        nicknameInput.value = savedNickname;
        nicknameInput.readOnly = true; 
        validateAndSetPostButton();
    }

    nicknameInput.addEventListener('input', validateAndSetPostButton);

    function validateAndSetPostButton() {
        const { isValid } = validateNickname(nicknameInput.value);
        postButton.disabled = !isValid;
    }

    const addGameBtn = document.getElementById('add-game-btn');
    addGameBtn.addEventListener('click', () => {
        document.getElementById('lotto-game-B').style.display = 'flex';
        document.getElementById('statDetailResultB').style.display = 'block';
        document.getElementById('game-B-placeholder').style.display = 'none';
    });

    const dropdownButtons = document.querySelectorAll('.adv-dropdown-button');
    dropdownButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.target;
            const content = document.getElementById(targetId);
            const isShown = content.classList.toggle('show');
            
            const baseText = button.textContent.slice(0, -2);
            button.textContent = isShown ? `${baseText} ▲` : `${baseText} ▼`;
        });
    });

    const popupOverlay = document.getElementById('image-popup-overlay');
    const popupImage = document.getElementById('popup-image');
    const closePopupBtn = document.getElementById('close-popup-btn');

    function openImagePopup(imageUrl) {
        popupImage.src = imageUrl;
        popupOverlay.style.display = 'flex';
    }

    function closeImagePopup() {
        popupOverlay.style.display = 'none';
        popupImage.src = '';
    }

    closePopupBtn.addEventListener('click', closeImagePopup);
    popupOverlay.addEventListener('click', (e) => {
        if (e.target === popupOverlay) {
            closeImagePopup();
        }
    });
    
    document.getElementById('resetProbBtn').addEventListener('click', resetProbPaper);
    document.getElementById('viewProbBtn').addEventListener('click', viewProbability);

    window.openImagePopup = openImagePopup;
});


// ==================================================================
// ===== 데이터 처리 함수 =====
// ==================================================================

function createLottoDataObject(probDf) {
    const newData = {};
    for (let i = 1; i <= 6; i++) {
        newData[`${i}칸확률`] = {};
    }
    probDf.data.forEach(row => {
        const lottoNumber = row.번호;
        for (let i = 1; i <= 6; i++) {
            const prob = row[`${i}칸확률`];
            if (prob !== undefined) {
                newData[`${i}칸확률`][lottoNumber] = prob;
            }
        }
    });
    return newData;
}

function parseAndPrepareData(dataText) {
    const lines = dataText.trim().split('\n');
    if (lines.length < 2) throw new Error("입력된 데이터가 충분하지 않습니다.");
    
    const headerLine = lines[0];
    const dataLines = lines.slice(1);
    const rawHeaders = headerLine.split('\t').filter(h => h);
    const processedHeaders = rawHeaders.slice(1); 
    const columns = ["번호"]; 

    for (let i = 0; i < processedHeaders.length; i += 2) {
        if (i + 1 < processedHeaders.length && processedHeaders[i+1].trim().toLowerCase() === '확률') {
            const baseName = processedHeaders[i].trim();
            columns.push(baseName); 
            columns.push(`${baseName}확률`); 
        } else {
            throw new Error(`헤더 형식이 '칸 확률' 패턴과 다릅니다.`);
        }
    }

    const data = [];
    for (const line of dataLines) {
        const parts = line.split('\t').filter(p => p);
        if (parts.length === 0) continue;
        const rowData = {};
        rowData["번호"] = parseInt(parts[0]);
        let colIndexInColumns = 1; 
        for (let i = 1; i < parts.length; i += 2) {
            const count = parseInt(parts[i]);
            const percentage = parseFloat(parts[i + 1].replace('%', ''));
            const baseColName = columns[colIndexInColumns];
            const probColName = columns[colIndexInColumns + 1];
            rowData[baseColName] = count;
            rowData[probColName] = percentage;
            colIndexInColumns += 2;
        }
        data.push(rowData);
    }

    return {
        columns: columns,
        data: data,
        includes: function(colName) { return this.columns.includes(colName); },
        filterNonZero: function(columnName) { return this.data.filter(row => row[columnName] > 0); }
    };
}


// ==================================================================
// ===== 번호 생성기 탭 기능 함수 =====
// ==================================================================

function generateCombinations() {
    if (!probDf || Object.keys(lottoData).length === 0) {
        alert("데이터가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.");
        return;
    }
    const outputText = document.getElementById('output-text');
    outputText.innerHTML = ''; 

    const selectionCombos = document.querySelectorAll('.controls-grid select');
    const numCombinationsInput = document.getElementById('num-combinations');
    const excludeWinnersCheckbox = document.getElementById('exclude-winners-checkbox');

    const columnSelectionChoices = {};
    for (let i = 0; i < selectionCombos.length; i++) {
        columnSelectionChoices[i + 1] = selectionCombos[i].value;
    }

    let numToGenerate;
    try {
        numToGenerate = parseInt(numCombinationsInput.value);
        if (isNaN(numToGenerate) || numToGenerate < 1 || numToGenerate > 5) {
            alert("생성할 조합 개수는 1에서 5 사이의 숫자여야 합니다.");
            return;
        }
    } catch (e) {
        alert("생성할 조합 개수를 숫자로 입력해주세요.");
        return;
    }

    let generatedCount = 0;
    let attempts = 0; 
    const maxAttempts = numToGenerate * 200; 

    const combinationRow = document.createElement('div');
    combinationRow.className = 'generated-combination-row';

    while (generatedCount < numToGenerate && attempts < maxAttempts) {
        attempts++;
        
        const generatedPairs = [];
        const generatedNumbersSet = new Set();

        for (let colNum = 1; colNum <= 6; colNum++) {
            if (generatedNumbersSet.size >= 6) break;
            const colType = columnSelectionChoices[colNum];
            const columnName = `${colNum}칸확률`;
            const selectedNum = get_random_number_from_column(probDf, columnName, colType, generatedNumbersSet);
            if (selectedNum !== null) {
                generatedNumbersSet.add(selectedNum);
                generatedPairs.push({ number: selectedNum, type: colType, originalSlot: colNum });
            }
        }
        
        while (generatedNumbersSet.size < 6) {
            const randomNumber = Math.floor(Math.random() * 45) + 1;
            if (!generatedNumbersSet.has(randomNumber)) {
                generatedNumbersSet.add(randomNumber);
                generatedPairs.push({ number: randomNumber, type: 'random', originalSlot: '추가' });
            }
        }

        generatedPairs.sort((a, b) => a.number - b.number);
        const finalCombinationList = generatedPairs.map(p => p.number);

        if (excludeWinnersCheckbox.checked) {
            const combinationString = finalCombinationList.join(',');
            if (firstPlaceNumbers.has(combinationString)) {
                continue; 
            }
        }

        generatedCount++;

        const container = document.createElement('div');
        container.className = 'generated-combination-container';
        const header = document.createElement('div');
        header.className = 'combination-header';
        header.innerHTML = `<strong>${generatedCount}:</strong>`;
        container.appendChild(header);
        const combinationFrame = document.createElement('div');
        combinationFrame.className = 'prob-output-frame';
        const outputEl = document.createElement('div');
        outputEl.className = 'prob-output-text';

        generatedPairs.forEach(pair => {
            let prob = 0;
            let classText = '';
            if (typeof pair.originalSlot === 'number') {
                const colName = `${pair.originalSlot}칸확률`;
                prob = lottoData[colName]?.[pair.number] ?? 0;
                classText = `${pair.originalSlot}칸`;
            } else {
                prob = 0;
                classText = '추가';
            }
            let classCss = '';
            switch (pair.type) {
                case 'top': classCss = 'high'; break;
                case 'bottom': classCss = 'low'; break;
                case 'random': classCss = 'random'; break;
            }
            const item = document.createElement('div');
            item.className = 'prob-result-item';
            if (classCss) item.classList.add(classCss);
            item.innerHTML = `
                <div class="prob-num">${pair.number}</div>
                <div class="prob-percent">${prob.toFixed(2)}%</div>
                <div class="prob-class">${classText}</div>
            `;
            outputEl.appendChild(item);
        });

        combinationFrame.appendChild(outputEl);
        container.appendChild(combinationFrame);
        combinationRow.appendChild(container);
    }

    outputText.appendChild(combinationRow);

    if (attempts >= maxAttempts && generatedCount < numToGenerate) {
        alert("유효한 조합을 찾는 데 시간이 너무 오래 걸립니다. 필터링 조건이 너무 엄격할 수 있습니다.");
    }
}

function get_random_number_from_column(prob_df, column_name, selection_type, exclude_numbers = new Set()) {
    if (!prob_df || !prob_df.columns.includes(column_name)) return null;

    const base_column_name = column_name.replace('확률', ''); 
    let initial_rows = prob_df.data;

    if (selection_type === 'random') {
        const min_appearance = parseInt(document.getElementById('min-appearance-select').value);
        initial_rows = prob_df.data.filter(row => row[base_column_name] > min_appearance);
    }

    let eligible_rows = [];
    if (selection_type === 'top') {
        eligible_rows = initial_rows.filter(row => row[column_name] > 2);
    } else if (selection_type === 'bottom') {
        eligible_rows = initial_rows.filter(row => row[column_name] >= 0.2 && row[column_name] <= 2.5);
    } else { 
        eligible_rows = initial_rows;
    }
    
    let eligible_numbers = eligible_rows.map(row => row.번호);
    let final_eligible_numbers = eligible_numbers.filter(num => !exclude_numbers.has(num));

    if (final_eligible_numbers.length === 0) {
        if (selection_type === 'random') {
             const min_appearance = parseInt(document.getElementById('min-appearance-select').value);
             final_eligible_numbers = prob_df.data
                .filter(row => row[base_column_name] > min_appearance)
                .map(row => row.번호)
                .filter(num => !exclude_numbers.has(num));
        } else {
             final_eligible_numbers = prob_df.data
                .map(row => row.번호)
                .filter(num => !exclude_numbers.has(num));
        }
        if (final_eligible_numbers.length === 0) return null;
    }

    return final_eligible_numbers[Math.floor(Math.random() * final_eligible_numbers.length)];
}


// ==================================================================
// ===== 탭, 통계, 커뮤니티 등 전역 함수들 =====
// ==================================================================

function showTab(tabIdx) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab${tabIdx}`).classList.add('active');
    document.querySelector(`.tab-button:nth-child(${tabIdx})`).classList.add('active');

    if (tabIdx === 5) {
        loadPosts();
    }
}

function renderLottoPaper() {
    ['A','B'].forEach(game => {
        const grid1 = document.getElementById('lottoGame' + game + '_row1');
        const grid2 = document.getElementById('lottoGame' + game + '_row2');
        const grid3 = document.getElementById('lottoGame' + game + '_row3');
        if (!grid1 || !grid2 || !grid3) return;
        
        grid1.innerHTML = '';
        grid2.innerHTML = '';
        grid3.innerHTML = '';

        for(let i = 1; i <= 45; i++) {
            const btn = document.createElement('div');
            btn.className = 'lotto-num';
            if (selectedNums[game].includes(i)) btn.classList.add('selected');
            if (!selectedNums[game].includes(i) && selectedNums[game].length >= 6) btn.classList.add('disabled');
            btn.innerHTML = `<span>${i}</span>`;
            btn.onclick = () => {
                selectedGame = game;
                if(selectedNums[game].includes(i)) {
                    selectedNums[game] = selectedNums[game].filter(x => x !== i);
                } else if(selectedNums[game].length < 6) {
                    selectedNums[game].push(i);
                }
                renderLottoPaper();
                checkLottoStats();
            };
            
            if (i <= 15) grid1.appendChild(btn);
            else if (i <= 30) grid2.appendChild(btn);
            else grid3.appendChild(btn);
        }
        const gameDiv = document.querySelector(`.lotto-game[data-game="${game}"]`);
        if(selectedGame === game) gameDiv.classList.add('selected');
        else gameDiv.classList.remove('selected');

        const headerDiv = gameDiv.querySelector('.lotto-game-header > div');
        let probCheckBtn = document.getElementById(`probCheckBtn${game}`);
        if (!probCheckBtn) {
            probCheckBtn = document.createElement('button');
            probCheckBtn.id = `probCheckBtn${game}`;
            probCheckBtn.className = 'lotto-prob-check-btn';
            probCheckBtn.textContent = '확률 확인';
            probCheckBtn.onclick = () => copyAndSwitchToProbTab(game);
            headerDiv.appendChild(probCheckBtn);
        }
        probCheckBtn.style.display = (selectedNums[game].length === 6 && selectedGame === game) ? 'inline-block' : 'none';
    });
}

function copyAndSwitchToProbTab(game) {
    const numbersToCopy = selectedNums[game];
    if (numbersToCopy && numbersToCopy.length === 6) {
        selectedProbNums = [...numbersToCopy];
        renderProbPaper();
        showTab(3);
        viewProbability();
    }
}

function autoSelect(game, event) {
    event.stopPropagation();
    let nums = selectedNums[game] ? [...selectedNums[game]] : [];
    while(nums.length < 6) {
        let n = Math.floor(Math.random() * 45) + 1;
        if(!nums.includes(n)) nums.push(n);
    }
    selectedNums[game] = nums;
    selectedGame = game;
    renderLottoPaper();
    checkLottoStats();
}

function autoSelectAll() {
    const autoSelectAllBtn = document.getElementById('autoSelectAllBtn');
    const counterSpan = document.getElementById('auto-gen-counter');

    if (autoGenerateInterval) {
        clearInterval(autoGenerateInterval);
        autoGenerateInterval = null;
        autoSelectAllBtn.textContent = '랜덤 번호 조합';
        document.getElementById('resetBtn').disabled = false;
        return;
    }

    const runSingleCycle = () => {
        autoGenerateCount++; 
        counterSpan.textContent = `총 ${autoGenerateCount}회`; 
        ['A','B'].forEach(game => {
            let nums = [];
            while(nums.length < 6) {
                let n = Math.floor(Math.random() * 45) + 1;
                if(!nums.includes(n)) nums.push(n);
            }
            selectedNums[game] = nums;
        });
        renderLottoPaper();
        checkLottoStats();
    };

    autoGenerateCount = 0; 
    counterSpan.style.display = 'inline-block'; 
    runSingleCycle(); 

    const autoGenerateCheckbox = document.getElementById('auto-generate-checkbox');
    if (autoGenerateCheckbox.checked) {
        if (isWinFound) {
            playWinSound();
            return;
        }
        autoSelectAllBtn.textContent = '자동 생성 중지';
        document.getElementById('resetBtn').disabled = true;
        const speed = parseInt(document.querySelector('input[name="speed-control"]:checked').value);
        autoGenerateInterval = setInterval(() => {
            runSingleCycle();
            if (isWinFound) {
                playWinSound();
                clearInterval(autoGenerateInterval);
                autoGenerateInterval = null;
                autoSelectAllBtn.textContent = '랜덤 번호 조합';
                document.getElementById('resetBtn').disabled = false;
            }
        }, speed);
    } else {
        const pauseCheckbox = document.getElementById('pause-on-win-checkbox');
        if (isWinFound && pauseCheckbox.checked) {
            playWinSound();
            autoSelectAllBtn.disabled = true;
            setTimeout(() => { autoSelectAllBtn.disabled = false; }, 1000);
        }
    }
}

function playWinSound() {
    const winSound = document.getElementById('winSound');
    winSound.volume = parseFloat(document.querySelector('input[name="sound-control"]:checked').value);
    if (winSound.volume > 0) {
        winSound.play().catch(e => console.log("Sound play failed:", e));
    }
}

function resetLottoStats() {
    if (autoGenerateInterval) {
        clearInterval(autoGenerateInterval);
        autoGenerateInterval = null;
        document.getElementById('autoSelectAllBtn').textContent = '랜덤 번호 조합';
        document.getElementById('resetBtn').disabled = false;
    }
    selectedNums = {A:[], B:[]};
    document.getElementById('rank-slider').value = 4;
    updateSliderTrack();
    renderLottoPaper();
    document.getElementById('probDisplayA').innerHTML = '';
    document.getElementById('probDisplayB').innerHTML = '';
    document.getElementById('statDetailResultA').innerHTML = '';
    document.getElementById('statDetailResultB').innerHTML = '';
    autoGenerateCount = 0;
    const counterSpan = document.getElementById('auto-gen-counter');
    counterSpan.textContent = '';
    counterSpan.style.display = 'none';
    document.getElementById('lotto-game-B').style.display = 'none';
    document.getElementById('statDetailResultB').style.display = 'none';
    document.getElementById('game-B-placeholder').style.display = 'flex';
}

function getCombinationProbability(numbers) {
    if (Object.keys(lottoData).length === 0) return "0.00";
    let sum = 0;
    const sortedNumbers = [...numbers].sort((a, b) => a - b);
    for (let i = 0; i < 6; i++) {
        const colName = `${i+1}칸확률`;
        const num = sortedNumbers[i];
        if (lottoData[colName] && lottoData[colName][num]) {
            sum += lottoData[colName][num];
        }
    }
    return (sum / 6).toFixed(2);
}

function checkLottoStats() {
    isWinFound = false;
    const maxRank = parseInt(document.getElementById('rank-slider').value);
    if (lottoHistory.length === 0) return;

    ['A','B'].forEach(game => {
        const nums = selectedNums[game];
        const resultContainer = document.getElementById(`statDetailResult${game}`);
        const probDisplay = document.getElementById(`probDisplay${game}`);
        let gameHtml = '';

        if (nums.length === 6) {
            const prob = getCombinationProbability(nums);
            probDisplay.innerHTML = `<strong>조합 확률:</strong> ${prob}%`;
            let first = [], second = [], third = [], fourth = [];
            
            for (let i = 0; i < lottoHistory.length; i++) {
                const win = lottoHistory[i].numbers;
                const bonus = lottoHistory[i].bonus;
                const match = nums.filter(n => win.includes(n)).length;

                if (match === 6) first.push({draw: lottoHistory[i].draw, numbers: win});
                else if (match === 5 && nums.includes(bonus)) second.push({draw: lottoHistory[i].draw, numbers: win, bonus: bonus});
                else if (match === 5) third.push({draw: lottoHistory[i].draw, numbers: win, bonus: bonus});
                else if (match === 4) fourth.push({draw: lottoHistory[i].draw, numbers: win, bonus: bonus});
            }

            function makePartition(title, arr, rank) {
                if (arr.length === 0) return '';
                if (rank <= maxRank) {
                    isWinFound = true;
                    let listItems = '';
                    arr.forEach(item => {
                        const winNums = item.numbers.map(n => nums.includes(n) ? `<b>${n}</b>` : `<span class="non-winning-num">${n}</span>`).join(', ');
                        let bonusText = (rank === 2 && item.bonus) ? ` [B: <b>${item.bonus}</b>]` : '';
                        listItems += `<li class="partition-${rank}">${title} - ${item.draw}회 [${winNums}]${bonusText}</li>`;
                    });
                    return listItems;
                }
                return '';
            }
            
            let fullList = '';
            fullList += makePartition('🥇 1등', first, 1);
            fullList += makePartition('🥈 2등', second, 2);
            fullList += makePartition('🥉 3등', third, 3);
            fullList += makePartition('🏅 4등', fourth, 4);

            resultContainer.innerHTML = fullList ? `<ul>${fullList}</ul>` : '<div style="color:#888;text-align:center;padding-top:25px;">일치 내역이 없습니다.</div>';
        } else {
            resultContainer.innerHTML = '';
            probDisplay.innerHTML = '';
        }
    });
}

function updateSliderTrack() {
    const slider = document.getElementById('rank-slider');
    const percentage = ((slider.value - slider.min) * 100) / (slider.max - slider.min);
    slider.style.setProperty('--slider-progress', `${percentage}%`);
}

function updateImageName(inputId, nameId) {
    const input = document.getElementById(inputId);
    const nameSpan = document.getElementById(nameId);
    const label = document.querySelector(`label[for="${inputId}"]`);
    if (input.files.length > 0) {
        nameSpan.textContent = input.files[0].name;
        label.classList.add('uploaded');
    } else {
        nameSpan.textContent = '';
        label.classList.remove('uploaded');
    }
}

async function loadPosts() {
    const feed = document.getElementById('community-feed');
    const paginationContainer = document.getElementById('pagination-container');
    feed.innerHTML = '게시글을 불러오는 중...'; 
    paginationContainer.innerHTML = '';

    try {
        const response = await fetch(`${WORKER_URL}/posts`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        allPosts = (await response.json()).reverse();
        currentPage = 1;
        displayCurrentPage();
    } catch (e) {
        feed.innerHTML = `<div style="text-align:center; color:red;">게시글을 불러오는 데 실패했습니다: ${e.message}</div>`;
    }
}

function displayCurrentPage() {
    renderPage(currentPage);
    renderPagination();
}

function renderPage(page) {
    const feed = document.getElementById('community-feed');
    feed.innerHTML = '';
    if (allPosts.length === 0) {
        feed.innerHTML = '<div style="text-align:center; color:#888;">아직 게시글이 없습니다.</div>';
        return;
    }

    const startIndex = (page - 1) * postsPerPage;
    const endIndex = startIndex + postsPerPage;
    const pagePosts = allPosts.slice(startIndex, endIndex);

    pagePosts.forEach(post => {
        const postElement = document.createElement('div');
        postElement.className = 'community-post';
        let formattedDate = '';
        if (post.created_at) {
            const date = new Date(post.created_at);
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            formattedDate = `${year}-${month}-${day} ${hours}:${minutes}`;
        }
        const safeNickname = post.nickname.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const metaString = [formattedDate, post.partial_ip || ''].filter(Boolean).join(' / ');
        const imageUrl = post.image1_url || post.image2_url;
        const imageButtonHTML = imageUrl ? `<button class="view-image-btn" data-image-url="${imageUrl}">이미지</button>` : '';
        postElement.innerHTML = `
            <div class="post-left">
                <div class="post-author">
                    <span><strong>${safeNickname}</strong></span>
                    <span class="post-meta">${metaString}</span>
                </div>
                ${imageButtonHTML}
            </div>
            <div class="post-right">
                <div class="post-text">${post.content ? post.content.replace(/</g, "&lt;").replace(/>/g, "&gt;") : ''}</div>
            </div>
        `;
        feed.appendChild(postElement); 
    });

    feed.querySelectorAll('.view-image-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const url = event.currentTarget.dataset.imageUrl;
            if (url) window.openImagePopup(url);
        });
    });
}

function renderPagination() {
    const paginationContainer = document.getElementById('pagination-container');
    paginationContainer.innerHTML = '';
    const totalPages = Math.ceil(allPosts.length / postsPerPage);
    if (totalPages <= 1) return;

    const createBtn = (text, page) => {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.className = 'page-btn';
        btn.addEventListener('click', () => {
            currentPage = page;
            displayCurrentPage();
        });
        return btn;
    };

    const prevButton = createBtn('이전', currentPage - 1);
    prevButton.disabled = currentPage === 1;
    paginationContainer.appendChild(prevButton);

    for (let i = 1; i <= totalPages; i++) {
        const pageButton = createBtn(i, i);
        if (i === currentPage) pageButton.classList.add('active');
        paginationContainer.appendChild(pageButton);
    }

    const nextButton = createBtn('다음', currentPage + 1);
    nextButton.disabled = currentPage === totalPages;
    paginationContainer.appendChild(nextButton);
}

function validateNickname(nickname) {
    const trimmed = nickname.trim();
    if (trimmed.length === 0) return { isValid: false, message: "닉네임을 입력해주세요." };
    if (!/^[a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣_-]+$/.test(trimmed)) return { isValid: false, message: "닉네임에는 특수문자를 사용할 수 없습니다. (-, _ 제외)" };
    const profanityList = ["바보", "멍청이", "개새끼", "씨발", "시발"];
    if (profanityList.some(word => trimmed.includes(word))) return { isValid: false, message: "닉네임에 비속어를 사용할 수 없습니다." };
    let byteLength = 0;
    for (let i = 0; i < trimmed.length; i++) byteLength += trimmed.charCodeAt(i) > 127 ? 2 : 1;
    if (byteLength > 10) return { isValid: false, message: "닉네임은 10바이트를 초과할 수 없습니다. (한글 2바이트, 영문/숫자 1바이트)" };
    return { isValid: true, message: "사용 가능한 닉네임입니다." };
}

async function uploadImage(fileInput) {
    if (fileInput.files.length === 0) {
        return null;
    }
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('image', file);

    try {
        // Assuming the worker has an '/upload' endpoint for images
        const response = await fetch(`${WORKER_URL}/upload`, {
            method: 'POST',
            body: formData,
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Image upload failed with status ${response.status}: ${errorText}`);
        }
        const result = await response.json();
        // Assuming the worker returns a JSON with the URL, e.g., { "url": "..." }
        return result.url || null;
    } catch (e) {
        console.error('Image upload error:', e);
        alert(`이미지 업로드에 실패했습니다: ${e.message}`);
        return null;
    }
}

async function createPost() {
    const nicknameInput = document.getElementById('nickname-input');
    const nickname = nicknameInput.value.trim();
    const text = document.getElementById('community-text').value.trim();
    const imageUpload1 = document.getElementById('image-upload1');
    const imageUpload2 = document.getElementById('image-upload2');
    const postButton = document.getElementById('post-button');

    const validation = validateNickname(nickname);
    if (!validation.isValid) {
        alert(validation.message);
        return;
    }
    if (!text && imageUpload1.files.length === 0 && imageUpload2.files.length === 0) {
        alert("글 내용이나 이미지를 추가해주세요.");
        return;
    }

    postButton.disabled = true;
    postButton.textContent = '등록 중...';

    try {
        let imageUrl1 = null;
        let imageUrl2 = null;

        if (imageUpload1.files.length > 0) {
            postButton.textContent = '이미지1 업로드 중...';
            imageUrl1 = await uploadImage(imageUpload1);
            if (!imageUrl1) {
                throw new Error("이미지1 업로드에 실패했습니다. 다시 시도해주세요.");
            }
        }
        if (imageUpload2.files.length > 0) {
            postButton.textContent = '이미지2 업로드 중...';
            imageUrl2 = await uploadImage(imageUpload2);
            if (!imageUrl2) {
                throw new Error("이미지2 업로드에 실패했습니다. 다시 시도해주세요.");
            }
        }

        postButton.textContent = '게시글 등록 중...';

        const response = await fetch(`${WORKER_URL}/posts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nickname,
                content: text,
                image1_url: imageUrl1,
                image2_url: imageUrl2
            }),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!localStorage.getItem('lottoAppNickname')) {
            localStorage.setItem('lottoAppNickname', nickname);
            nicknameInput.readOnly = true;
        }

        document.getElementById('community-text').value = '';
        imageUpload1.value = '';
        imageUpload2.value = '';
        document.getElementById('char-counter').textContent = '0 / 20';
        updateImageName('image-upload1', 'image-name1');
        updateImageName('image-upload2', 'image-name2');

        await loadPosts();

    } catch (e) {
        alert(`글을 등록하는 데 실패했습니다: ${e.message}`);
    } finally {
        postButton.disabled = false;
        postButton.textContent = '글쓰기';
    }
}

function renderProbPaper() {
    const grid1 = document.getElementById('lottoGameProb_row1');
    const grid2 = document.getElementById('lottoGameProb_row2');
    const grid3 = document.getElementById('lottoGameProb_row3');
    if (!grid1 || !grid2 || !grid3) return;

    grid1.innerHTML = '';
    grid2.innerHTML = '';
    grid3.innerHTML = '';

    for (let i = 1; i <= 45; i++) {
        const btn = document.createElement('div');
        btn.className = 'lotto-num';
        if (selectedProbNums.includes(i)) btn.classList.add('selected');
        if (!selectedProbNums.includes(i) && selectedProbNums.length >= 6) btn.classList.add('disabled');
        btn.innerHTML = `<span>${i}</span>`;
        btn.onclick = () => {
            if (selectedProbNums.includes(i)) {
                selectedProbNums = selectedProbNums.filter(x => x !== i);
            } else if (selectedProbNums.length < 6) {
                selectedProbNums.push(i);
            }
            renderProbPaper();
        };
        if (i <= 15) grid1.appendChild(btn);
        else if (i <= 30) grid2.appendChild(btn);
        else grid3.appendChild(btn);
    }
}

function resetProbPaper() {
    selectedProbNums = [];
    document.getElementById('prob-output-text').innerHTML = '';
    document.querySelector('.prob-output-frame').style.display = 'none';
    renderProbPaper();
}

function classifyProbability(prob) {
    return prob > 2.5 ? "높음" : "낮음";
}

function viewProbability() {
    if (selectedProbNums.length !== 6) {
        alert("6개의 번호를 선택해주세요.");
        return;
    }
    if (Object.keys(lottoData).length === 0) {
        alert("데이터가 로드되지 않았습니다. 잠시 후 다시 시도해주세요.");
        return;
    }

    const sortedNums = [...selectedProbNums].sort((a, b) => a - b);
    const outputEl = document.getElementById('prob-output-text');
    const outputFrame = document.querySelector('.prob-output-frame');
    outputEl.innerHTML = '';

    sortedNums.forEach((num, index) => {
        const position = index + 1;
        const colName = `${position}칸확률`;
        const prob = lottoData[colName]?.[num] ?? 0;
        const classification = classifyProbability(prob);
        const item = document.createElement('div');
        item.className = 'prob-result-item';
        const classCss = classification === "높음" ? 'high' : 'low';
        item.classList.add(classCss);
        item.innerHTML = `
            <div class="prob-num">${num}</div>
            <div class="prob-percent">${prob.toFixed(2)}%</div>
            <div class="prob-class">${classification}</div>
        `;
        outputEl.appendChild(item);
    });
    
    outputFrame.style.display = 'flex';
}