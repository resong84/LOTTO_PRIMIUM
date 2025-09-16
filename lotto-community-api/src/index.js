// src/index.js

// CORS 헤더: 다른 웹사이트(우리 로또 앱)에서 우리 서버로 요청을 보낼 수 있도록 허용
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // 모든 출처 허용
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret-Key',
};

// 라우터: 요청 URL과 메서드에 따라 어떤 함수를 실행할지 결정
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // OPTIONS 메서드(Preflight) 처리: 실제 요청을 보내기 전 서버가 요청을 받을 수 있는지 확인하는 절차
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // --- API 라우팅 ---
    // 1. 모든 게시글 가져오기 (GET /posts)
    if (path === '/posts' && request.method === 'GET') {
      return getAllPosts(request, env);
    }
    // 2. 새 게시글 작성하기 (POST /posts)
    if (path === '/posts' && request.method === 'POST') {
      return createPost(request, env);
    }
    // 3. 특정 게시글 삭제하기 (DELETE /posts/게시글ID)
    if (path.startsWith('/posts/') && request.method === 'DELETE') {
      const postId = path.split('/')[2];
      return deletePost(request, env, postId);
    }

    // 해당하는 주소가 없으면 404 Not Found 응답
    return new Response('Not Found', { status: 404 });
  },
};

// --- 기능별 함수 ---

/**
 * 모든 게시글을 KV에서 조회하여 반환하는 함수
 */
async function getAllPosts(request, env) {
  try {
    // KV에서 모든 키-값 목록을 가져옴
    const list = await env.LOTTO_POSTS.list();
    const posts = [];
    for (const key of list.keys) {
      const value = await env.LOTTO_POSTS.get(key.name);
      if (value) {
        posts.push(JSON.parse(value));
      }
    }
    // JSON 형태로 응답
    return new Response(JSON.stringify(posts), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    return new Response(`Error fetching posts: ${e.message}`, { status: 500 });
  }
}

/**
 * 새 게시글을 생성하고 KV에 저장하는 함수
 */
async function createPost(request, env) {
  try {
    const postData = await request.json();
    const newId = Date.now().toString(); // 현재 시간을 고유 ID로 사용

    // 요청 헤더에서 클라이언트 IP 주소 가져오기
    const ip = request.headers.get('CF-Connecting-IP') || 'IP Not Found';

    const newPost = {
      id: newId,
      nickname: postData.nickname,
      content: postData.content,
      image1_url: postData.image1_url,
      image2_url: postData.image2_url,
      created_at: new Date().toISOString(),
      ip_address: ip, // IP 주소 함께 저장
    };

    // KV에 새 게시글 저장 (키: ID, 값: 게시글 데이터)
    await env.LOTTO_POSTS.put(newId, JSON.stringify(newPost));

    return new Response(JSON.stringify(newPost), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 201, // 201 Created
    });
  } catch (e) {
    return new Response(`Error creating post: ${e.message}`, { status: 500 });
  }
}

/**
 * 특정 게시글을 ID를 이용해 KV에서 삭제하는 함수
 */
async function deletePost(request, env, postId) {
  // 1. 관리자 인증: 요청 헤더에서 비밀 키를 확인
  const providedKey = request.headers.get('X-Admin-Secret-Key');
  // env.ADMIN_SECRET_KEY는 Cloudflare 대시보드에 설정할 비밀 키 변수
  if (providedKey !== env.ADMIN_SECRET_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!postId) {
    return new Response('Post ID is required', { status: 400 });
  }

  try {
    // 2. KV에서 해당 ID의 게시글 삭제
    await env.LOTTO_POSTS.delete(postId);
    return new Response(JSON.stringify({ success: true, message: 'Post deleted' }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    return new Response(`Error deleting post: ${e.message}`, { status: 500 });
  }
}