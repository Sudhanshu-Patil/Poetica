document.addEventListener('DOMContentLoaded', function() {
    const generateBtn = document.getElementById('generateBtn');
    
    generateBtn.addEventListener('click', function() {
        let poemPrompt = document.getElementById('poemPrompt').value;
        let poemOutput = document.getElementById('poemOutput');
        let emotionOutput = document.getElementById('emotionOutput');
        
        poemOutput.innerHTML = "Generating poem...";
        emotionOutput.innerHTML = ""; // Clear previous emotions

        poemOutput.style.fontSize = '20px';
        poemOutput.style.fontWeight = 'bold';
        fetch('/generate_poem', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: poemPrompt }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.poem) {
                poemOutput.innerHTML = ""; // Clear "Generating poem..." text

                const poem = data.poem.replace(/\n/g, '\n'); // Keep line breaks
                const poemLines = poem.split('\n'); // Split the poem by lines

                let i = 0;
                let j = 0;
                let line = poemLines[i];

                function typeWriter() {
                    const BATCH_SIZE = 5;  // Number of characters to append in one go
                    let batch = '';
                
                    function appendBatch() {
                        if (j < line.length) {
                            batch += line.charAt(j);
                            j++;
                
                            if (j % BATCH_SIZE === 0 || j === line.length) {
                                const span = document.createElement('span');
                                span.textContent = batch;
                                span.classList.add('colorful-text');
                                poemOutput.appendChild(span);
                                batch = '';
                                setTimeout(appendBatch, 20);  // Adjusted typing speed for smoother scroll
                            } else {
                                appendBatch();
                            }
                        } else {
                            const br = document.createElement('br');
                            poemOutput.appendChild(br); // Add line break after each line
                            j = 0;
                            i++;
                            if (i < poemLines.length) {
                                line = poemLines[i];
                                setTimeout(typeWriter, 20); // Reduced this too for faster speed
                            } else {
                                displayEmotions(data.top_emotion, data.emotions);
                            }
                        }
                    }
                
                    appendBatch();
                }
                function getEmotionEmoji(emotion) {
                    const emotionMap = {
                        joy: '😊',
                        sadness: '😢',
                        anger: '😡',
                        surprise: '😲',
                        // neutral: '😐',
                        fear: '😨',
                        love: '🥰'
                        // Add more as needed
                    };
                    return emotionMap[emotion] ;
                }

                function displayEmotions(topEmotion, emotions) {
                    let topEmotionEmoji = getEmotionEmoji(topEmotion);
                
                    let emotionList = `<p style="font-size: 3em;"><strong>Top Emotion:</strong> ${topEmotionEmoji} ${topEmotion}</p>`;
                    emotionList += "<p><strong>Emotions Breakdown:</strong></p><ul>";
                    for (const [emotion, score] of Object.entries(emotions)) {
                        emotionList += `<li style="font-size: 1.5em;">${getEmotionEmoji(emotion)} ${emotion}: ${(score * 100).toFixed(2)}%</li>`;
                    }
                    emotionList += "</ul>";
                    emotionOutput.innerHTML = emotionList;
                    triggerEmojiPopUp(topEmotionEmoji);
                }
                function triggerEmojiPopUp(emoji) {
                    const emojiPopUp = document.createElement('div');
                    emojiPopUp.classList.add('emoji-popup');
                    emojiPopUp.textContent = emoji;
                    document.body.appendChild(emojiPopUp);
                
                    // Remove the emoji pop-up after the animation completes
                    setTimeout(() => {
                        emojiPopUp.remove();
                    }, 2000); // Duration of the pop-up effect
                }
                typeWriter();
            } else if (data.error) {
                poemOutput.innerHTML = `<p class="red-text">${data.error}</p>`;
            }
        })
        .catch(error => {
            console.error('Error generating poem:', error);
            poemOutput.innerHTML = `<p class="red-text">An error occurred. Please try again.</p>`;
        });
    });
});