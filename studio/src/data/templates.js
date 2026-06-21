// studio/src/data/templates.js

export const TEMPLATES = {
    transformer: {
        name: "Transformer Encoder Block",
        description: "Standard transformer encoder with MHA + FFN + LayerNorm",
        inputShape: [2, 128, 512],
        code: `import torch
import torch.nn as nn

class TransformerEncoderBlock(nn.Module):
    def __init__(self, d_model=512, nhead=8, dim_feedforward=2048, dropout=0.1):
        super().__init__()
        self.attention = nn.MultiheadAttention(d_model, nhead, dropout=dropout, batch_first=True)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.feedforward = nn.Sequential(
            nn.Linear(d_model, dim_feedforward),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(dim_feedforward, d_model),
        )
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        attn_out, _ = self.attention(x, x, x)
        x = self.norm1(x + self.dropout(attn_out))
        ff_out = self.feedforward(x)
        x = self.norm2(x + self.dropout(ff_out))
        return x`
    },

    cnn: {
        name: "Simple CNN Classifier",
        description: "Two conv layers + adaptive pooling + linear classifier",
        inputShape: [2, 3, 64, 64],
        code: `import torch
import torch.nn as nn

class SimpleCNN(nn.Module):
    def __init__(self, num_classes=10):
        super().__init__()
        self.conv1 = nn.Conv2d(3, 64, 3, padding=1)
        self.relu1 = nn.ReLU()
        self.conv2 = nn.Conv2d(64, 128, 3, padding=1)
        self.relu2 = nn.ReLU()
        self.pool = nn.AdaptiveAvgPool2d((4, 4))
        self.flatten = nn.Flatten()
        self.classifier = nn.Linear(128 * 4 * 4, num_classes)

    def forward(self, x):
        x = self.relu1(self.conv1(x))
        x = self.relu2(self.conv2(x))
        x = self.pool(x)
        x = self.flatten(x)
        return self.classifier(x)`
    },

    tissue_llm: {
        name: "Tissue LLM Cell",
        description: "Compressed micro-LM cell from the Tissue LLM architecture",
        inputShape: [2, 128],
        code: `import torch
import torch.nn as nn

class TissueLLMCell(nn.Module):
    """A compressed micro-LM cell from the Tissue LLM architecture.
    
    20 of these cells, organized into tissues, vote together to recover
    the accuracy of a full-scale LLM at a fraction of the compute.
    """
    def __init__(self, vocab_size=50000, d_model=512, d_compressed=64):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, d_model)
        self.compress = nn.Linear(d_model, d_compressed)
        self.norm = nn.LayerNorm(d_compressed)
        self.process = nn.Sequential(
            nn.Linear(d_compressed, d_compressed * 4),
            nn.ReLU(),
            nn.Linear(d_compressed * 4, d_compressed),
        )
        self.expand = nn.Linear(d_compressed, d_model)
        self.output_head = nn.Linear(d_model, vocab_size)

    def forward(self, token_ids):
        x = self.embedding(token_ids)
        x = self.norm(self.compress(x))
        x = x + self.process(x)
        x = self.expand(x)
        return self.output_head(x)`
    }
};
