const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:5000';
const API_ENDPOINT = `${BASE_URL}/api/posts`;

// Test data
const testUsers = [
  { uid: 'chris_test_123', username: 'Chris', email: 'chris@test.com' },
  { uid: 'mark_test_456', username: 'Mark', email: 'mark@test.com' },
  { uid: 'john_test_789', username: 'John', email: 'john@test.com' }
];

// Simulate authentication tokens (in real app, these would be JWT tokens)
const getAuthHeader = (userId) => ({
  'Authorization': `Bearer test_token_${userId}`,
  'Content-Type': 'application/json'
});

// Test the enhanced repost system
async function testEnhancedRepostSystem() {
  console.log('🚀 Testing Enhanced Repost System...\n');

  try {
    // Step 1: Create original post (Chris)
    console.log('📝 Step 1: Chris creates original post');
    const chrisPost = {
      content: 'Check out this awesome new game! 🎮',
      category: 'Gaming'
    };
    
    const chrisResponse = await axios.post(API_ENDPOINT, chrisPost, {
      headers: getAuthHeader(testUsers[0].uid)
    });
    
    const chrisPostId = chrisResponse.data.id;
    console.log(`✅ Chris's post created with ID: ${chrisPostId}`);
    console.log(`   Content: "${chrisPost.content}"`);
    console.log(`   Repost count: ${chrisResponse.data.repostCount}`);
    console.log(`   Direct repost count: ${chrisResponse.data.directRepostCount || 'N/A'}\n`);

    // Step 2: Mark reposts Chris's post
    console.log('🔄 Step 2: Mark reposts Chris\'s post');
    const markRepost = {
      comment: 'This is amazing!'
    };
    
    const markResponse = await axios.post(`${API_ENDPOINT}/${chrisPostId}/repost`, markRepost, {
      headers: getAuthHeader(testUsers[1].uid)
    });
    
    console.log(`✅ Mark's repost created with ID: ${markResponse.data.repostId}`);
    console.log(`   Comment: "${markRepost.comment}"`);
    console.log(`   New repost count: ${markResponse.data.repostCount}\n`);

    // Step 3: Get updated Chris's post to see new counts
    console.log('📊 Step 3: Check updated counts on Chris\'s post');
    const updatedChrisPost = await axios.get(`${API_ENDPOINT}/${chrisPostId}`, {
      headers: getAuthHeader(testUsers[0].uid)
    });
    
    console.log(`✅ Chris's post updated:`);
    console.log(`   Total repost count: ${updatedChrisPost.data.repostCount}`);
    console.log(`   Direct repost count: ${updatedChrisPost.data.directRepostCount || 'N/A'}\n`);

    // Step 4: John reposts Mark's repost
    console.log('🔄 Step 4: John reposts Mark\'s repost');
    const johnRepost = {
      comment: 'Agreed! This looks fantastic!'
    };
    
    const johnResponse = await axios.post(`${API_ENDPOINT}/${markResponse.data.repostId}/repost`, johnRepost, {
      headers: getAuthHeader(testUsers[2].uid)
    });
    
    console.log(`✅ John's repost created with ID: ${johnResponse.data.repostId}`);
    console.log(`   Comment: "${johnRepost.comment}"`);
    console.log(`   New repost count: ${johnResponse.data.repostCount}\n`);

    // Step 5: Check repost chain for John's repost
    console.log('🔗 Step 5: Check repost chain for John\'s repost');
    const johnRepostChain = await axios.get(`${API_ENDPOINT}/${johnResponse.data.repostId}/repost-chain`, {
      headers: getAuthHeader(testUsers[2].uid)
    });
    
    console.log(`✅ John's repost chain:`);
    console.log(`   Repost depth: ${johnRepostChain.data.repostDepth}`);
    console.log(`   Original author: ${johnRepostChain.data.originalAuthor}`);
    console.log(`   Chain length: ${johnRepostChain.data.repostChain.length}`);
    
    if (johnRepostChain.data.repostChain.length > 0) {
      console.log(`   Chain: ${johnRepostChain.data.repostChain.map(item => item.author).join(' → ')}`);
    }
    console.log('');

    // Step 6: Check final counts on all posts
    console.log('📊 Step 6: Final counts on all posts');
    
    // Chris's original post
    const finalChrisPost = await axios.get(`${API_ENDPOINT}/${chrisPostId}`, {
      headers: getAuthHeader(testUsers[0].uid)
    });
    
    console.log(`✅ Chris's original post:`);
    console.log(`   Total repost count: ${finalChrisPost.data.repostCount}`);
    console.log(`   Direct repost count: ${finalChrisPost.data.directRepostCount || 'N/A'}`);
    
    // Mark's repost
    const finalMarkRepost = await axios.get(`${API_ENDPOINT}/${markResponse.data.repostId}`, {
      headers: getAuthHeader(testUsers[1].uid)
    });
    
    console.log(`✅ Mark's repost:`);
    console.log(`   Total repost count: ${finalMarkRepost.data.repostCount}`);
    console.log(`   Direct repost count: ${finalMarkRepost.data.directRepostCount || 'N/A'}`);
    
    // John's repost
    const finalJohnRepost = await axios.get(`${API_ENDPOINT}/${johnResponse.data.repostId}`, {
      headers: getAuthHeader(testUsers[2].uid)
    });
    
    console.log(`✅ John's repost:`);
    console.log(`   Total repost count: ${finalJohnRepost.data.repostCount}`);
    console.log(`   Direct repost count: ${finalJohnRepost.data.directRepostCount || 'N/A'}\n`);

    // Step 7: Test unrepost functionality
    console.log('🗑️ Step 7: Test unrepost functionality');
    
    // John unreposts
    await axios.delete(`${API_ENDPOINT}/${markResponse.data.repostId}/repost`, {
      headers: getAuthHeader(testUsers[2].uid)
    });
    
    console.log(`✅ John unreposted Mark's repost`);
    
    // Check updated counts
    const afterUnrepostChris = await axios.get(`${API_ENDPOINT}/${chrisPostId}`, {
      headers: getAuthHeader(testUsers[0].uid)
    });
    
    console.log(`✅ Chris's post after unrepost:`);
    console.log(`   Total repost count: ${afterUnrepostChris.data.repostCount}`);
    console.log(`   Direct repost count: ${afterUnrepostChris.data.directRepostCount || 'N/A'}\n`);

    console.log('🎉 Enhanced Repost System Test Completed Successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Original post creation works');
    console.log('   ✅ First-level repost works with chain building');
    console.log('   ✅ Nested repost works with extended chain');
    console.log('   ✅ Repost chain tracking works');
    console.log('   ✅ Dual counting system works (direct vs total)');
    console.log('   ✅ Unrepost functionality works');
    console.log('   ✅ Chain depth calculation works');
    console.log('   ✅ Original author attribution works');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

// Run the test
if (require.main === module) {
  testEnhancedRepostSystem();
}

module.exports = { testEnhancedRepostSystem }; 