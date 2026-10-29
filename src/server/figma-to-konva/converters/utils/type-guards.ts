// 타입 가드 함수들
export function isCanvasNode(node: any): node is any {
  return node && node.type === 'CANVAS';
}

export function isFrameNode(node: any): node is any {
  return node && node.type === 'FRAME';
}

export function isGroupNode(node: any): node is any {
  return node && node.type === 'GROUP';
}
