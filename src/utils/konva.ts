
export const getAllElements = (
  elements: any[],
  parentX: number = 0,
  parentY: number = 0,
): any[] => {
  return elements.reduce((all, element) => {
    // 가시성이 false인 경우, 현재 요소를 건너뛰고 다음 요소로 넘어갑니다.
    if (element.visible === false) {
      return all;
    }

    // 현재 요소의 최종 절대 좌표 계산
    const absoluteX = parentX + (element.x || 0);
    const absoluteY = parentY + (element.y || 0);

    // 그룹 또는 프레임인 경우, 자식 요소들을 재귀적으로 처리합니다.
    if (element.children) {
      // 그룹 자체를 오버레이 대상으로 추가하고 자식 요소들을 재귀적으로 평탄화합니다.
      const childrenElements = getAllElements(element.children, absoluteX, absoluteY);
      return all.concat([{ ...element, x: absoluteX, y: absoluteY }], childrenElements);
    } else {
      // 그룹이 아닌 경우, 계산된 절대 좌표를 포함한 새 요소 객체를 배열에 추가합니다.
      return all.concat([{ ...element, x: absoluteX, y: absoluteY }]);
    }
  }, []); // 초기 누적 값은 빈 배열입니다.
};
