'use client';

import FooterLinks from './FooterLinks';
import Logo from '@/shared/ui/Logo';
import { useDialog } from '@/shared/ui/Dialog';
import Button from '@/shared/ui/Button/Button';

const Footer = () => {
  const { openConfirm } = useDialog();

  const handleWithdrawal = async () => {
    const confirmed = await openConfirm({
      title: '회원 탈퇴',
      description:
        '회원 탈퇴 시, 계정 정보 및 보유 중인 모든 크레딧\n(유상 구매 포함)은 영구 삭제되어 복구가 불가능합니다.\n정말로 탈퇴하시겠습니까?',
      confirmText: '확인',
      cancelText: '취소',
    });

    if (confirmed) {
      // TODO: 회원 탈퇴 API 호출
    }
  };

  return (
    <footer className="w-full bg-white pt-8 pb-4 pl-4.5 sm:py-15.25 sm:pr-22 sm:pl-40">
      <div className="block lg:flex lg:items-center lg:justify-between">
        <div className="flex-column mb-7 gap-2 lg:mb-0">
          <Logo symbolOnly symbolWidth={27.27} symbolHeight={30} />
          <p className="description hidden text-gray-400 xl:block">
            Copyright © 2026 SellFarm. All rights reserved.
          </p>
        </div>

        <div className="space-y-6">
          <FooterLinks />

          <div className="description space-y-2 text-gray-400">
            <div className="flex flex-col items-start gap-2 lg:flex-row lg:items-center">
              <p>셀팜 대표자 김인겸, 노병곤</p>
              <span className="hidden lg:block">|</span>
              <p>사업자등록번호: 580-37-01480</p>
              <span className="hidden lg:block">|</span>
              <p>통신판매업신고번호: 제2024-안양동안-1927호</p>
            </div>
            <div className="flex flex-col items-start gap-2 lg:flex-row lg:items-center">
              <p>경기도 안양시 동안구 경수대로 883번길 96, 2층 9호 (13955)</p>
              <span className="hidden lg:block">|</span>
              <p>문의: 010-3281-6168</p>
              <span className="hidden lg:block">|</span>
              <p>이메일: cs@leverpage.com</p>
            </div>
          </div>
          {/* <Button
            onClick={handleWithdrawal}
            className="description text-gray-300 underline hover:text-gray-400 transition-colors"
          >
            회원탈퇴
          </Button> */}
          <p className="description block text-gray-400 xl:hidden">
            Copyright © 2025 NOBASECLASS All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
