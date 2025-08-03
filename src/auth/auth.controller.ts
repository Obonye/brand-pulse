import { Controller, Post, Body, HttpStatus, Get, UseGuards, Request, Response } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response as ExpressResponse } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from '../modules/auth/dto/register.dto';
import { LoginDto } from '../modules/auth/dto/login.dto';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { LoggerService } from '../common/logger/logger.service';

@ApiTags('Authentication')  // Groups these endpoints in Swagger docs
@Controller('auth')         // All routes start with /api/auth
export class AuthController {
  private logger: ReturnType<LoggerService['setContext']>;
  
  constructor(
    private authService: AuthService,
    private loggerService: LoggerService
  ) {
    this.logger = this.loggerService.setContext('AuthController');
  }

  @Post('register')  // POST /api/auth/register
  @ApiOperation({ summary: 'Register new tenant and admin user' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Registration successful' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Registration failed' 
  })
  async register(@Body() registerDto: RegisterDto) {
    this.logger.info('POST /auth/register - Registration attempt', { 
      companyName: registerDto.companyName,
      adminEmail: registerDto.adminEmail,
      subscriptionTier: registerDto.subscriptionTier 
    });
    
    const result = await this.authService.register(registerDto);
    
    this.logger.info('POST /auth/register - Registration successful', { 
      tenantId: result.tenant.id,
      tenantName: result.tenant.name,
      userEmail: result.user.email 
    });
    
    return result;
  }

  @Post('login')  // POST /api/auth/login
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Login successful' 
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: 'Invalid credentials' 
  })
  async login(@Body() loginDto: LoginDto, @Response() res: ExpressResponse) {
    this.logger.info('POST /auth/login - Login attempt', { 
      email: loginDto.email 
    });

    const result = await this.authService.login(loginDto);
    
    this.logger.info('POST /auth/login - Login successful', { 
      userId: result.user.id,
      email: result.user.email,
      tenantId: result.tenant.id 
    });
    
    // Set httpOnly cookie with the access token
    res.cookie('access_token', result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Return user data without the token
    const { access_token, ...userResponse } = result;
    return res.json(userResponse);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Logout successful' 
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: 'Invalid token' 
  })
  async logout(@Request() req: any, @Response() res: ExpressResponse) {
    this.logger.info('POST /auth/logout - Logout request', { 
      userId: req.user.id,
      email: req.user.email 
    });

    const result = await this.authService.logout(req.user);
    
    this.logger.info('POST /auth/logout - Logout successful', { 
      userId: req.user.id,
      email: req.user.email 
    });
    
    // Clear the httpOnly cookie
    res.clearCookie('access_token');
    
    return res.json(result);
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current session information' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Session information retrieved' 
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: 'Invalid token' 
  })
  async getSession(@Request() req: any) {
    this.logger.debug('GET /auth/session - Session check request', { 
      userId: req.user.id,
      email: req.user.email 
    });

    const result = await this.authService.getSession(req.user);
    
    this.logger.debug('GET /auth/session - Session valid', { 
      userId: req.user.id,
      email: req.user.email 
    });
    
    return result;
  }
}