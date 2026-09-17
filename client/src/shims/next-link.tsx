import React, { forwardRef } from "react";
import { Link as RouterLink } from "react-router-dom";

type NextLinkProps = {
  href: string;
  children?: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  prefetch?: boolean;
  target?: string;
  rel?: string;
  style?: React.CSSProperties;
  id?: string;
};

const NextLink = forwardRef<HTMLAnchorElement, NextLinkProps>(
  ({ href, children, prefetch, ...rest }, ref) => (
    <RouterLink ref={ref} to={href} {...rest}>
      {children}
    </RouterLink>
  ),
);

NextLink.displayName = "NextLink";

export default NextLink;
