/**
 * palette.js
 * The 10 palette blocks shipped in the µLM Studio prototype.
 * Matches the PALETTE_BLOCKS definition in tracer.py exactly.
 */

export const CATEGORY_COLORS = {
  CORE:           '#6B7280',
  ATTENTION:      '#5B8DB8',
  NORM:           '#5A9B7C',
  VISION:         '#9B7CB8',
  REGULARIZATION: '#8A8E99',
  ACTIVATION:     '#8A8E99',
  INPUT:          '#6B7280',
  OUTPUT:         '#6B7280',
};

export const PALETTE_BLOCKS = [
  // CORE ─────────────────────────────────────────────────────────────────────
  {
    id: 'Embedding',
    label: 'Embedding',
    pytorch_class: 'nn.Embedding',
    category: 'CORE',
    sync_state: 'traced',
    input_shape: '[batch, seq]',
    output_shape: '[batch, seq, d_model]',
    default_params: { num_embeddings: 50000, embedding_dim: 512 },
  },
  {
    id: 'Linear',
    label: 'Linear',
    pytorch_class: 'nn.Linear',
    category: 'CORE',
    sync_state: 'traced',
    input_shape: '[*, in_features]',
    output_shape: '[*, out_features]',
    default_params: { in_features: 512, out_features: 512 },
  },
  {
    id: 'FeedForward',
    label: 'FeedForward',
    pytorch_class: 'nn.Sequential(Linear, ReLU, Linear)',
    category: 'CORE',
    sync_state: 'traced',
    input_shape: '[batch, seq, d_model]',
    output_shape: '[batch, seq, d_model]',
    default_params: { d_model: 512, dim_feedforward: 2048 },
  },
  {
    id: 'OutputHead',
    label: 'Output Head',
    pytorch_class: 'nn.Linear',
    category: 'CORE',
    sync_state: 'traced',
    input_shape: '[*, d_model]',
    output_shape: '[*, vocab_size]',
    default_params: { in_features: 512, out_features: 50000 },
  },
  // ATTENTION ────────────────────────────────────────────────────────────────
  {
    id: 'MultiheadAttention',
    label: 'Multi-Head Attention',
    pytorch_class: 'nn.MultiheadAttention',
    category: 'ATTENTION',
    sync_state: 'atomic',     // ◆ badge
    input_shape: '[batch, seq, d_model] × 3',
    output_shape: '[batch, seq, d_model]',
    default_params: { embed_dim: 512, num_heads: 8, batch_first: true },
    drill_down: 'mha_interior',
  },
  // NORM ─────────────────────────────────────────────────────────────────────
  {
    id: 'LayerNorm',
    label: 'LayerNorm',
    pytorch_class: 'nn.LayerNorm',
    category: 'NORM',
    sync_state: 'traced',
    input_shape: '[*, d_model]',
    output_shape: 'same shape',
    default_params: { normalized_shape: [512] },
  },
  {
    id: 'RMSNorm',
    label: 'RMSNorm',
    pytorch_class: 'custom nn.Module',
    category: 'NORM',
    sync_state: 'traced',
    input_shape: '[*, d_model]',
    output_shape: 'same shape',
    default_params: { d_model: 512 },
  },
  // VISION ───────────────────────────────────────────────────────────────────
  {
    id: 'Conv2d',
    label: 'Conv2D',
    pytorch_class: 'nn.Conv2d',
    category: 'VISION',
    sync_state: 'traced',
    input_shape: '[batch, C, H, W]',
    output_shape: '[batch, C_out, H_out, W_out]',
    default_params: { in_channels: 3, out_channels: 64, kernel_size: 3, padding: 1 },
  },
  // REGULARIZATION ───────────────────────────────────────────────────────────
  {
    id: 'Dropout',
    label: 'Dropout',
    pytorch_class: 'nn.Dropout',
    category: 'REGULARIZATION',
    sync_state: 'traced',
    input_shape: 'any',
    output_shape: 'same shape',
    default_params: { p: 0.1 },
  },
  // ACTIVATION ───────────────────────────────────────────────────────────────
  {
    id: 'Softmax',
    label: 'Softmax',
    pytorch_class: 'nn.Softmax',
    category: 'ACTIVATION',
    sync_state: 'traced',
    input_shape: '[*, features]',
    output_shape: 'same shape',
    default_params: { dim: -1 },
  },
];

/** Group blocks by category, preserving insertion order. */
export const PALETTE_BY_CATEGORY = PALETTE_BLOCKS.reduce((acc, block) => {
  if (!acc[block.category]) acc[block.category] = [];
  acc[block.category].push(block);
  return acc;
}, {});
