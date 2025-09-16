document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('login-btn');
    const secretKeyInput = document.getElementById('secret-key-input');

    // 로그인 버튼 클릭 이벤트
    loginBtn.addEventListener('click', () => {
        const secretKey = secretKeyInput.value;
        if (!secretKey) {
            alert('관리자 키를 입력하세요.');
            return;
        }
        // 입력된 키를 브라우저 임시 저장소(sessionStorage)에 저장
        sessionStorage.setItem('adminSecretKey', secretKey);
        loadPosts();
    });

    // 페이지 로드 시 이미 키가 저장되어 있으면 바로 게시글 로드 시도
    if (sessionStorage.getItem('adminSecretKey')) {
        loadPosts();
    }
});

// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// ⚠️ 중요: 이 주소를 본인의 Cloudflare Worker 주소로 반드시 변경하세요!
const WORKER_URL = 'https://lotto-community-api.resong84.workers.dev';
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

/**
 * 서버에서 모든 게시글을 불러오는 함수
 */
async function loadPosts() {
    const secretKey = sessionStorage.getItem('adminSecretKey');
    if (!secretKey) return; // 키가 없으면 함수 종료

    const postListDiv = document.getElementById('post-list');
    postListDiv.innerHTML = '게시글을 불러오는 중...';

    try {
        const response = await fetch(`${WORKER_URL}/posts`);
        
        // 서버에서 401(Unauthorized) 오류를 보내면 키가 틀린 것
        if (response.status === 401) {
             throw new Error('관리자 키가 올바르지 않습니다.');
        }
        if (!response.ok) {
            throw new Error('게시글을 불러오는 데 실패했습니다.');
        }
        
        const posts = await response.json();

        // 로그인 성공 시, 로그인 영역 숨기고 게시글 영역 표시
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('posts-section').style.display = 'block';

        postListDiv.innerHTML = ''; // 목록 초기화

        // 최신 글이 위로 오도록 정렬
        posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        if (posts.length === 0) {
            postListDiv.innerHTML = '<p>게시글이 없습니다.</p>';
            return;
        }

        posts.forEach(post => {
            const postEl = document.createElement('div');
            postEl.className = 'post-item';
            postEl.id = `post-${post.id}`;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '삭제';
            deleteBtn.onclick = () => deletePost(post.id);

            postEl.innerHTML = `
                <p><strong>닉네임:</strong> ${post.nickname}</p>
                <p><strong>내용:</strong> ${post.content || '내용 없음'}</p>
                <p class="post-meta">
                    <span>작성일: ${new Date(post.created_at).toLocaleString()}</span> / 
                    <span>IP: ${post.ip_address || 'N/A'}</span>
                </p>
            `;
            postEl.prepend(deleteBtn); // 삭제 버튼을 맨 앞에 추가
            postListDiv.appendChild(postEl);
        });

    } catch (error) {
        alert(error.message);
        postListDiv.innerHTML = '';
        sessionStorage.removeItem('adminSecretKey'); // 실패 시 저장된 키 제거
    }
}

/**
 * 특정 게시글을 서버에 삭제 요청하는 함수
 */
async function deletePost(postId) {
    if (!confirm(`정말로 이 게시글을 삭제하시겠습니까?`)) return;

    const secretKey = sessionStorage.getItem('adminSecretKey');

    try {
        const response = await fetch(`${WORKER_URL}/posts/${postId}`, {
            method: 'DELETE',
            headers: {
                // 요청 헤더에 비밀 키를 담아 보냄 (서버 인증용)
                'X-Admin-Secret-Key': secretKey
            }
        });

        if (!response.ok) {
            throw new Error('삭제에 실패했습니다. 키가 올바른지 확인해주세요.');
        }

        // 성공 시 화면에서 해당 게시글 DOM 제거
        const postElement = document.getElementById(`post-${postId}`);
        if (postElement) {
            postElement.remove();
        }
        alert('게시글이 삭제되었습니다.');

    } catch (error) {
        alert(error.message);
    }
}