document.addEventListener('DOMContentLoaded', () => {
    const generateButton = document.getElementById('generate-button');
    const outputText = document.getElementById('output-text');
    let probDf = null;
    let firstPlaceNumbers = new Set();

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
            probDf = parseAndPrepareData(dataText);
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

    function parseAndPrepareData(dataText) {
        const lines = dataText.trim().split('\n');
        if (lines.length < 2) {
            throw new Error("입력된 데이터가 충분하지 않습니다.");
        }

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
                throw new Error(`헤더 형식이 '칸 확률' 패턴과 다릅니다. 문제의 부분: '${processedHeaders[i]} ${processedHeaders[i+1] || ''}'`);
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
            includes: function(colName) {
                return this.columns.includes(colName);
            },
            filterNonZero: function(columnName) {
                return this.data.filter(row => row[columnName] > 0);
            }
        };
    }

    function get_random_number_from_column(prob_df, column_name, selection_type, exclude_numbers = new Set()) {
        if (!prob_df || !prob_df.columns.includes(column_name)) {
            return null;
        }

        const base_column_name = column_name.replace('확률', ''); 
        let initial_rows = prob_df.data;

        if (selection_type === 'random') {
            const min_appearance = parseInt(document.getElementById('min-appearance-select').value);
            initial_rows = prob_df.data.filter(row => {
                const count = row[base_column_name];
                return count > min_appearance;
            });
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

    function generateCombinations() {
        if (!probDf) {
            alert("데이터가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.");
            return;
        }
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

        while (generatedCount < numToGenerate && attempts < maxAttempts) {
            attempts++;
            const finalCombinationSet = new Set();
            const randomSelectedNumbers = []; 
            
            for (let colNum = 1; colNum <= 6; colNum++) {
                if (finalCombinationSet.size >= 6) break;

                const colType = columnSelectionChoices[colNum];
                const columnName = `${colNum}칸확률`;
                
                const exclusionSet = new Set(finalCombinationSet);

                const selectedNum = get_random_number_from_column(
                    probDf,
                    columnName,
                    colType,
                    exclusionSet
                );

                if (selectedNum !== null) {
                    finalCombinationSet.add(selectedNum);
                    if (colType === 'random') {
                        randomSelectedNumbers.push(selectedNum);
                    }
                }
            }
            
            while (finalCombinationSet.size < 6) {
                const randomNumber = Math.floor(Math.random() * 45) + 1;
                if (!finalCombinationSet.has(randomNumber)) {
                    finalCombinationSet.add(randomNumber);
                }
            }

            let finalCombinationList = Array.from(finalCombinationSet).sort((a, b) => a - b);

            if (excludeWinnersCheckbox.checked) {
                const combinationString = finalCombinationList.join(',');
                if (firstPlaceNumbers.has(combinationString)) {
                    continue; 
                }
            }

            generatedCount++;
            const resultDiv = document.createElement('div');
            resultDiv.classList.add('combination-result');

            const combinationNumber = generatedCount;
            const spacing = combinationNumber < 10 ? `&nbsp;&nbsp;` : ` `;
            const combinationText = `<strong>${combinationNumber}:</strong>${spacing}<span class="combination-numbers">[ ${finalCombinationList.join(', ')} ]</span>`;
            
            let randomValueText = "";
            if (randomSelectedNumbers.length > 0) {
                randomValueText = `<br><span class="random-value">R: ${randomSelectedNumbers.sort((a, b) => a - b).join(', ')}</span>`;
            }

            resultDiv.innerHTML = combinationText + randomValueText;
            outputText.appendChild(resultDiv);

            if (generatedCount % 5 === 0 && generatedCount < numToGenerate) {
                const spacer = document.createElement('div');
                spacer.style.height = '1em';
                outputText.appendChild(spacer);
            }
        }

        if (attempts >= maxAttempts && generatedCount < numToGenerate) {
            alert("유효한 조합을 찾는 데 시간이 너무 오래 걸립니다. 필터링 조건이 너무 엄격할 수 있습니다.");
        }
    }

    generateButton.addEventListener('click', generateCombinations);

    // 초기 데이터 로드
    loadData();
    loadFirstPlaceData();

    // --- 당첨 통계 조회 기능 추가 ---
    renderLottoPaper();
    showTab(1);
    
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

    // --- 커뮤니티 기능 추가 ---
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

    // --- User Guide Dropdown ---
    const userGuideButton = document.getElementById('user-guide-button');
    const userGuideContent = document.getElementById('user-guide-content');

    userGuideButton.addEventListener('click', () => {
        userGuideContent.classList.toggle('show');
        if (userGuideContent.classList.contains('show')) {
            userGuideButton.textContent = '사용 설명 ▲';
        } else {
            userGuideButton.textContent = '사용 설명 ▼';
        }
    });

    // --- Image Popup Logic ---
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
    // Make it globally accessible for inline event handlers
    window.openImagePopup = openImagePopup;
});


// ==================================================================
// ===== 탭, 통계, 커뮤니티 등 전역 함수들 =====
// ==================================================================

const WORKER_URL = 'https://lotto-community-api.resong84.workers.dev'; 

let selectedGame = 'A';
let selectedNums = {A:[], B:[]};
let isWinFound = false;
let autoGenerateInterval = null;
let autoGenerateCount = 0;

// Pagination variables
let allPosts = [];
let currentPage = 1;
const postsPerPage = 5;

function showTab(tabIdx) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab${tabIdx}`).classList.add('active');
    document.querySelector(`.tab-button:nth-child(${tabIdx})`).classList.add('active');

    if (tabIdx === 4) {
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
            if (selectedNums[game].includes(i)) {
                btn.classList.add('selected');
            }
            if (!selectedNums[game].includes(i) && selectedNums[game].length >= 6) {
                btn.classList.add('disabled');
            }
            
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
            
            if (i <= 15) {
                grid1.appendChild(btn);
            } else if (i <= 30) {
                grid2.appendChild(btn);
            } else {
                grid3.appendChild(btn);
            }
        }
        const gameDiv = document.querySelector(`.lotto-game[data-game="${game}"]`);
        if(selectedGame === game) {
            gameDiv.classList.add('selected');
        } else {
            gameDiv.classList.remove('selected');
        }
    });
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
    const autoGenerateCheckbox = document.getElementById('auto-generate-checkbox');
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

    if (autoGenerateCheckbox.checked) {
        if (isWinFound) {
            playWinSound();
            return;
        }

        autoSelectAllBtn.textContent = '자동 생성 중지';
        document.getElementById('resetBtn').disabled = true;
        
        const speed = parseInt(document.querySelector('input[name="speed-control"]:checked').value);
        
        let speedText = '';
        if (speed === 333) speedText = 'x3';
        if (speed === 200) speedText = 'x5';
        if (speed === 100) speedText = 'x10';
        document.getElementById('speed-display').textContent = speedText;

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
    let sum = 0;
    const sortedNumbers = [...numbers].sort((a, b) => a - b);
    for (let i = 0; i < 6; i++) {
        const colName = `${i+1}칸확률`;
        const num = sortedNumbers[i];
        if (typeof lottoData !== 'undefined' && lottoData[colName] && lottoData[colName][num]) {
            sum += lottoData[colName][num];
        }
    }
    return (sum / 6).toFixed(2);
}

function checkLottoStats() {
    isWinFound = false;
    const maxRank = parseInt(document.getElementById('rank-slider').value);
    
    if (typeof lottoHistory === 'undefined') {
        console.error("lottoHistory.js 파일이 로드되지 않았습니다.");
        return;
    }

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
                        const matchedNums = nums;
                        const winNums = item.numbers.map(n => matchedNums.includes(n) ? `<b>${n}</b>` : `<span class="non-winning-num">${n}</span>`).join(', ');
                        listItems += `<li class="partition-${rank}">${title} - ${item.draw}회 [${winNums}]</li>`;
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

            if(fullList) {
                gameHtml = `<ul>${fullList}</ul>`;
            }
            
            resultContainer.innerHTML = gameHtml || '<div style="color:#888;text-align:center;padding-top:25px;">일치 내역이 없습니다.</div>';
        } else {
            resultContainer.innerHTML = '';
            probDisplay.innerHTML = '';
        }
    });
}

function updateSliderTrack() {
    const slider = document.getElementById('rank-slider');
    const min = slider.min;
    const max = slider.max;
    const val = slider.value;
    const percentage = ((val - min) * 100) / (max - min);
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
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        allPosts = (await response.json()).reverse(); // 최신순으로 정렬
        
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

        const partialIp = post.partial_ip || ''; 
        const safeNickname = post.nickname.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        const metaParts = [];
        if (formattedDate) metaParts.push(formattedDate);
        if (partialIp) metaParts.push(partialIp);
        const metaString = metaParts.join(' / ');

        let imageButtonHTML = '';
        const imageUrl = post.image1_url || post.image2_url;
        if (imageUrl) {
            // Use a data attribute instead of onclick for better event handling
            imageButtonHTML = `<button class="view-image-btn" data-image-url="${imageUrl}">이미지</button>`;
        }

        const postHTML = `
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
        
        postElement.innerHTML = postHTML;
        feed.appendChild(postElement); 
    });

    // Add event listeners to the newly created image buttons
    feed.querySelectorAll('.view-image-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const url = event.currentTarget.dataset.imageUrl;
            if (url) {
                window.openImagePopup(url);
            }
        });
    });
}

function renderPagination() {
    const paginationContainer = document.getElementById('pagination-container');
    paginationContainer.innerHTML = '';
    const totalPages = Math.ceil(allPosts.length / postsPerPage);

    if (totalPages <= 1) return;

    const prevButton = document.createElement('button');
    prevButton.textContent = '이전';
    prevButton.className = 'page-btn';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayCurrentPage();
        }
    });
    paginationContainer.appendChild(prevButton);

    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = 'page-btn';
        if (i === currentPage) {
            pageButton.classList.add('active');
        }
        pageButton.addEventListener('click', () => {
            currentPage = i;
            displayCurrentPage();
        });
        paginationContainer.appendChild(pageButton);
    }

    const nextButton = document.createElement('button');
    nextButton.textContent = '다음';
    nextButton.className = 'page-btn';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            displayCurrentPage();
        }
    });
    paginationContainer.appendChild(nextButton);
}

function validateNickname(nickname) {
    const trimmed = nickname.trim();
    
    if (trimmed.length === 0) {
        return { isValid: false, message: "닉네임을 입력해주세요." };
    }

    const specialCharRegex = /^[a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣_-]+$/;
    if (!specialCharRegex.test(trimmed)) {
        return { isValid: false, message: "닉네임에는 특수문자를 사용할 수 없습니다. (-, _ 제외)" };
    }

    const profanityList = ["바보", "멍청이", "개새끼", "씨발", "시발"];
    for (const word of profanityList) {
        if (trimmed.includes(word)) {
            return { isValid: false, message: "닉네임에 비속어를 사용할 수 없습니다." };
        }
    }

    let byteLength = 0;
    for (let i = 0; i < trimmed.length; i++) {
        const charCode = trimmed.charCodeAt(i);
        if (charCode > 127) {
            byteLength += 2;
        } else {
            byteLength += 1;
        }
    }
    if (byteLength > 10) {
        return { isValid: false, message: "닉네임은 10바이트를 초과할 수 없습니다. (한글 2바이트, 영문/숫자 1바이트)" };
    }

    return { isValid: true, message: "사용 가능한 닉네임입니다." };
}

async function createPost() {
    const nicknameInput = document.getElementById('nickname-input');
    const nickname = nicknameInput.value.trim();
    const text = document.getElementById('community-text').value.trim();
    const postButton = document.getElementById('post-button');

    const validation = validateNickname(nickname);
    if (!validation.isValid) {
        alert(validation.message);
        return;
    }

    if (!text) { 
        alert("글 내용을 입력해주세요.");
        return;
    }

    postButton.disabled = true; 
    postButton.textContent = '등록 중...';

    const postData = {
        nickname: nickname,
        content: text,
        image1_url: null, 
        image2_url: null
    };

    try {
        const response = await fetch(`${WORKER_URL}/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(postData),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!localStorage.getItem('lottoAppNickname')) {
            localStorage.setItem('lottoAppNickname', nickname);
            nicknameInput.readOnly = true;
        }

        document.getElementById('community-text').value = '';
        document.getElementById('image-upload1').value = '';
        document.getElementById('image-upload2').value = '';
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

const lottoData = {
    "1칸확률": { 1: 12.83, 2: 12.40, 3: 9.43, 4: 10.20, 5: 7.82, 6: 7.22, 7: 5.52, 8: 4.84, 9: 5.95, 10: 4.16, 11: 3.82, 12: 3.23, 13: 1.87, 14: 2.04, 15: 1.87, 16: 1.44, 17: 0.85, 18: 0.93, 19: 0.51, 20: 0.93, 21: 0.17, 22: 0.34, 23: 0.51, 24: 0.42, 25: 0.17, 26: 0.25, 27: 0.17, 28: 0.00, 29: 0.08, 30: 0.00, 31: 0.00, 32: 0.00, 33: 0.00, 34: 0.00, 35: 0.00, 36: 0.00, 37: 0.00, 38: 0.00, 39: 0.00, 40: 0.00, 41: 0.00, 42: 0.00, 43: 0.00, 44: 0.00, 45: 0.00 },
    "2칸확률": { 1: 0.00, 2: 1.44, 3: 2.72, 4: 3.91, 5: 4.93, 6: 4.50, 7: 4.50, 8: 5.61, 9: 5.69, 10: 5.95, 11: 6.12, 12: 6.46, 13: 4.84, 14: 3.99, 15: 4.16, 16: 4.33, 17: 3.82, 18: 4.50, 19: 4.25, 20: 2.89, 21: 2.12, 22: 2.12, 23: 0.85, 24: 1.87, 25: 1.61, 26: 1.44, 27: 1.44, 28: 0.93, 29: 0.85, 30: 0.59, 31: 0.68, 32: 0.25, 33: 0.08, 34: 0.25, 35: 0.08, 36: 0.08, 37: 0.08, 38: 0.00, 39: 0.00, 40: 0.00, 41: 0.00, 42: 0.00, 43: 0.00, 44: 0.00, 45: 0.00 },
    "3칸확률": { 1: 0.00, 2: 0.00, 3: 0.00, 4: 0.34, 5: 1.02, 6: 0.85, 7: 1.78, 8: 1.70, 9: 1.70, 10: 3.91, 11: 2.89, 12: 4.08, 13: 4.25, 14: 4.33, 15: 4.16, 16: 4.59, 17: 4.33, 18: 3.91, 19: 4.67, 20: 4.67, 21: 5.44, 22: 5.18, 23: 4.08, 24: 4.08, 25: 3.06, 26: 4.42, 27: 3.48, 28: 3.31, 29: 2.89, 30: 2.04, 31: 1.19, 32: 2.04, 33: 1.95, 34: 0.76, 35: 1.10, 36: 0.51, 37: 0.42, 38: 0.42, 39: 0.17, 40: 0.17, 41: 0.00, 42: 0.08, 43: 0.00, 44: 0.00, 45: 0.00 },
    "4칸확률": { 1: 0.00, 2: 0.00, 3: 0.00, 4: 0.00, 5: 0.00, 6: 0.08, 7: 0.17, 8: 0.68, 9: 0.34, 10: 0.42, 11: 0.68, 12: 0.85, 13: 1.87, 14: 2.04, 15: 1.78, 16: 1.70, 17: 3.40, 18: 3.06, 19: 2.80, 20: 3.14, 21: 3.74, 22: 3.74, 23: 4.76, 24: 4.84, 25: 4.16, 26: 4.84, 27: 4.50, 28: 5.01, 29: 4.50, 30: 4.84, 31: 4.76, 32: 4.08, 33: 3.99, 34: 3.14, 35: 4.16, 36: 2.12, 37: 3.65, 38: 1.78, 39: 1.02, 40: 1.44, 41: 1.44, 42: 0.25, 43: 0.17, 44: 0.00, 45: 0.00 },
    "5칸확률": { 1: 0.00, 2: 0.00, 3: 0.00, 4: 0.00, 5: 0.00, 6: 0.00, 7: 0.00, 8: 0.08, 9: 0.08, 10: 0.08, 11: 0.08, 12: 0.00, 13: 0.08, 14: 0.42, 15: 0.25, 16: 0.76, 17: 0.59, 18: 0.85, 19: 1.10, 20: 1.10, 21: 2.04, 22: 1.02, 23: 2.29, 24: 2.29, 25: 2.63, 26: 2.12, 27: 3.91, 28: 4.84, 29: 3.31, 30: 3.57, 31: 4.50, 32: 4.93, 33: 5.01, 34: 6.29, 35: 6.29, 36: 5.44, 37: 5.01, 38: 5.35, 39: 5.69, 40: 4.93, 41: 4.08, 42: 4.50, 43: 2.63, 44: 1.78, 45: 0.00 },
    "6칸확률": { 1: 0.00, 2: 0.00, 3: 0.00, 4: 0.00, 5: 0.00, 6: 0.00, 7: 0.00, 8: 0.00, 9: 0.00, 10: 0.00, 11: 0.00, 12: 0.00, 13: 0.00, 14: 0.00, 15: 0.00, 16: 0.00, 17: 0.00, 18: 0.00, 19: 0.00, 20: 0.08, 21: 0.08, 22: 0.34, 23: 0.25, 24: 0.76, 25: 0.51, 26: 1.36, 27: 0.59, 28: 1.10, 29: 1.44, 30: 0.93, 31: 1.78, 32: 2.55, 33: 1.61, 34: 2.55, 35: 2.72, 36: 4.08, 37: 5.01, 38: 5.18, 39: 6.63, 40: 7.22, 41: 7.22, 42: 8.75, 43: 10.37, 44: 11.98, 45: 14.87 }
};